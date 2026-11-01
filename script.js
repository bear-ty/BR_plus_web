(() => {
  const links = [...document.querySelectorAll('.nav-panel a')];
  const sections = links
    .map(link => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  const updateNavigation = () => {
    const y = window.scrollY + window.innerHeight * .35;
    let active = sections[0];
    sections.forEach(section => {
      if (section.offsetTop <= y) active = section;
    });
    links.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${active.id}`);
    });
  };

  window.addEventListener('scroll', updateNavigation, { passive: true });
  updateNavigation();

  const hero = document.querySelector('.hero');
  const wall = document.querySelector('.dataset-wall');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (hero && wall) {
    hero.addEventListener('pointermove', event => {
      if (reduceMotion.matches) return;
      const bounds = hero.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - .5;
      const y = (event.clientY - bounds.top) / bounds.height - .5;
      wall.style.setProperty('--pointer-x', `${x * 18}px`);
      wall.style.setProperty('--pointer-y', `${y * 18}px`);
    });

    hero.addEventListener('pointerleave', () => {
      wall.style.setProperty('--pointer-x', '0px');
      wall.style.setProperty('--pointer-y', '0px');
    });

    window.addEventListener('scroll', () => {
      const progress = Math.min(window.scrollY / window.innerHeight, 1);
      wall.style.setProperty('--cover-progress', progress.toFixed(3));
    }, { passive: true });
  }

  // Each tile can start independently: a slow poster must never freeze the wall.
  const wallStates = new Map();
  let startupReady = false;
  let heroVisible = true;
  let manualPlayback = false;
  let lastFrameTime = 0;
  let resizeFrame = 0;
  const playCover = document.createElement('button');
  playCover.className = 'cover-play';
  playCover.type = 'button';
  playCover.textContent = 'Play videos';
  playCover.hidden = true;
  hero.appendChild(playCover);

  const refreshPlayButton = () => {
    playCover.hidden = ![...wallStates.values()].some(state => state.blocked && state.visible);
  };

  const revealFrame = state => {
    const video = state.video;
    if (!state.visible || video.paused || video.readyState < 2 || document.hidden) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (state.visible && !video.paused && video.readyState >= 2 && !document.hidden) {
        state.poster.classList.add('is-video-ready');
      }
    }));
  };

  const detachVideo = state => {
    state.video.pause();
    if (state.loaded) {
      state.source.removeAttribute('src');
      state.video.load();
    }
    state.loaded = false;
    state.poster.classList.remove('is-video-ready');
  };

  const syncVideo = state => {
    const { video } = state;
    if (!video.isConnected || !video.getClientRects().length) {
      detachVideo(state);
      return;
    }
    if (document.hidden || !heroVisible || !startupReady || (!state.posterSettled && !manualPlayback)) {
      video.pause();
      return;
    }
    if ((state.near || state.visible) && !state.loaded) {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.preload = 'metadata';
      state.source.src = state.source.dataset.src;
      state.loaded = true;
      video.load();
    }
    if (!state.visible) {
      video.pause();
      return;
    }
    if (!state.loaded || state.playPending || (state.blocked && !manualPlayback)) return;
    if (!video.paused) {
      revealFrame(state);
      return;
    }
    state.playPending = true;
    video.play().then(() => {
      state.blocked = false;
      revealFrame(state);
    }).catch(error => {
      if (error.name !== 'AbortError' && state.visible && !document.hidden) state.blocked = true;
    }).finally(() => {
      state.playPending = false;
      refreshPlayButton();
    });
  };
  const syncVideos = () => wallStates.forEach(syncVideo);

  const loadObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const state = wallStates.get(entry.target);
      if (state) { state.near = entry.isIntersecting; syncVideo(state); }
    });
  }, { rootMargin: '120px 0px' });
  const playbackObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const state = wallStates.get(entry.target);
      if (state) { state.visible = entry.isIntersecting; syncVideo(state); }
    });
    refreshPlayButton();
  }, { threshold: 0 });

  const registerTile = tile => {
    const video = tile.querySelector('video');
    const source = video.querySelector('source');
    source.removeAttribute('src');
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    const poster = document.createElement('img');
    poster.className = 'wall-poster';
    poster.alt = '';
    poster.decoding = 'async';
    poster.src = video.poster;
    tile.appendChild(poster);
    const state = { video, source, poster, loaded: false, near: false, visible: false,
      blocked: false, playPending: false, posterSettled: poster.complete && poster.naturalWidth > 0 };
    wallStates.set(video, state);
    const settle = () => { state.posterSettled = true; syncVideo(state); };
    poster.addEventListener('load', settle, { once: true });
    poster.addEventListener('error', settle, { once: true });
    // This deadline also covers stalled image requests and unreliable image.decode().
    state.posterTimer = window.setTimeout(settle, 1500);
    video.addEventListener('playing', () => {
      revealFrame(state);
      if (typeof video.requestVideoFrameCallback === 'function') {
        video.requestVideoFrameCallback(() => revealFrame(state));
      }
    });
    video.addEventListener('loadeddata', () => revealFrame(state));
    video.addEventListener('timeupdate', () => revealFrame(state));
    loadObserver.observe(video);
    playbackObserver.observe(video);
  };

  const removeTile = tile => {
    const video = tile.querySelector('video');
    const state = wallStates.get(video);
    if (state) {
      clearTimeout(state.posterTimer);
      loadObserver.unobserve(video);
      playbackObserver.unobserve(video);
      detachVideo(state);
      wallStates.delete(video);
    }
    tile.remove();
  };

  const columns = [...wall.querySelectorAll('.wall-column')].map((column, index) => {
    const tiles = [...column.children];
    const templates = tiles.map(tile => tile.cloneNode(true));
    const track = document.createElement('div');
    track.className = 'wall-track';
    column.appendChild(track);
    tiles.forEach(tile => { track.appendChild(tile); registerTile(tile); });
    return { column, track, templates, offset: 0, speed: index % 2 ? 5 : 6, nextTemplate: 0 };
  });

  const sizePools = () => {
    resizeFrame = 0;
    columns.forEach(column => {
      const { track, templates } = column;
      if (!column.column.getClientRects().length) {
        while (track.children.length > templates.length) removeTile(track.lastElementChild);
        column.offset = 0;
        track.style.transform = 'translate3d(0, 0, 0)';
        return;
      }
      const gap = parseFloat(getComputedStyle(track).rowGap) || 0;
      const largest = Math.max(...[...track.children].map(tile => tile.offsetHeight));
      // One tile of overscan lets the first fully leave before it is recycled.
      const required = column.column.clientHeight + largest + gap;
      while (track.scrollHeight < required && track.children.length < 40) {
        const tile = templates[column.nextTemplate++ % templates.length].cloneNode(true);
        track.appendChild(tile);
        registerTile(tile);
      }
      while (track.children.length > templates.length) {
        const last = track.lastElementChild;
        if (track.scrollHeight - last.offsetHeight - gap < required) break;
        removeTile(last);
      }
      column.gap = gap;
      column.step = parseFloat(getComputedStyle(track.firstElementChild).height) + gap;
      column.offset %= column.step;
      track.style.transform = `translate3d(0, ${-column.offset}px, 0)`;
    });
    syncVideos();
  };
  const scheduleSizing = () => {
    if (!resizeFrame) resizeFrame = requestAnimationFrame(sizePools);
  };
  const columnResize = new ResizeObserver(scheduleSizing);
  columns.forEach(column => columnResize.observe(column.column));
  sizePools();

  const animate = time => {
    const elapsed = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, .08) : 0;
    lastFrameTime = time;
    if (heroVisible && !document.hidden && !reduceMotion.matches) {
      columns.forEach(column => {
        if (!column.column.getClientRects().length) return;
        column.offset += elapsed * column.speed;
        let first = column.track.firstElementChild;
        while (first && column.offset >= column.step) {
          column.offset -= column.step;
          column.track.appendChild(first);
          first = column.track.firstElementChild;
          column.step = parseFloat(getComputedStyle(first).height) + column.gap;
        }
        column.track.style.transform = `translate3d(0, ${-column.offset}px, 0)`;
      });
    }
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
  const heroObserver = new IntersectionObserver(entries => {
    heroVisible = entries[0].isIntersecting;
    lastFrameTime = 0;
    syncVideos();
  });
  heroObserver.observe(hero);
  window.setTimeout(() => { startupReady = true; syncVideos(); }, 350);
  playCover.addEventListener('click', () => {
    manualPlayback = true;
    startupReady = true;
    wallStates.forEach(state => { state.blocked = false; syncVideo(state); });
    refreshPlayButton();
  });
  document.addEventListener('visibilitychange', () => { lastFrameTime = 0; syncVideos(); });
  window.addEventListener('resize', scheduleSizing, { passive: true });
  const motionChanged = () => { lastFrameTime = 0; syncVideos(); };
  if (typeof reduceMotion.addEventListener === 'function') reduceMotion.addEventListener('change', motionChanged);
  else reduceMotion.addListener(motionChanged);

  const demoVideo = document.getElementById('demo-video');
  const demoViewport = document.querySelector('.demo-viewport');
  const demoPlay = document.getElementById('demo-play');
  const demoRestart = document.getElementById('demo-restart');
  const demoSeek = document.getElementById('demo-seek');
  const demoCurrent = document.getElementById('demo-current');
  const demoDuration = document.getElementById('demo-duration');
  const demoSpeed = document.getElementById('demo-speed');
  const demoPages = [...document.querySelectorAll('.demo-page')];

  if (demoVideo && demoPages.length) {
    let demoIndex = 0;
    let seeking = false;

    const formatTime = seconds => {
      if (!Number.isFinite(seconds)) return '00:00';
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    };

    const updateDemoTime = () => {
      demoCurrent.textContent = formatTime(demoVideo.currentTime);
      demoDuration.textContent = formatTime(demoVideo.duration);
      if (!seeking && Number.isFinite(demoVideo.duration) && demoVideo.duration > 0) {
        demoSeek.value = Math.round((demoVideo.currentTime / demoVideo.duration) * 1000);
      }
    };

    const updatePlayButton = () => {
      demoPlay.textContent = demoVideo.paused ? 'Play' : 'Pause';
    };

    const showDemo = (index, autoplay = false) => {
      demoIndex = (index + demoPages.length) % demoPages.length;
      const source = demoPages[demoIndex].dataset.video;
      demoVideo.preload = 'metadata';
      demoVideo.poster = source.replace('assets/videos/', 'assets/posters/').replace(/\.mp4(?=\?|$)/, '.jpg');
      if (demoVideo.getAttribute('src') !== source) {
        demoVideo.src = source;
        demoVideo.load();
      }
      demoPages.forEach((page, pageIndex) => {
        const isActive = pageIndex === demoIndex;
        page.classList.toggle('active', isActive);
        page.setAttribute('aria-pressed', String(isActive));
      });
      if (autoplay) demoVideo.play().catch(() => {});
      updatePlayButton();
    };

    const ensureDemoSource = () => {
      if (!demoVideo.getAttribute('src')) showDemo(demoIndex);
    };

    const toggleDemoPlayback = () => {
      if (demoVideo.paused) {
        ensureDemoSource();
        demoVideo.play().catch(() => {});
      } else {
        demoVideo.pause();
      }
    };

    demoPages.forEach((page, pageIndex) => {
      page.addEventListener('click', () => {
        showDemo(pageIndex, !demoVideo.paused && !demoVideo.ended);
      });
    });

    document.querySelector('.demo-prev').addEventListener('click', () => {
      showDemo(demoIndex - 1, !demoVideo.paused && !demoVideo.ended);
    });

    document.querySelector('.demo-next').addEventListener('click', () => {
      showDemo(demoIndex + 1, !demoVideo.paused && !demoVideo.ended);
    });

    demoPlay.addEventListener('click', toggleDemoPlayback);
    demoVideo.addEventListener('click', toggleDemoPlayback);
    demoRestart.addEventListener('click', () => {
      ensureDemoSource();
      demoVideo.currentTime = 0;
      demoVideo.play().catch(() => {});
    });

    demoSeek.addEventListener('input', () => {
      ensureDemoSource();
      seeking = true;
      if (Number.isFinite(demoVideo.duration) && demoVideo.duration > 0) {
        demoVideo.currentTime = (Number(demoSeek.value) / 1000) * demoVideo.duration;
        demoCurrent.textContent = formatTime(demoVideo.currentTime);
      }
    });
    demoSeek.addEventListener('change', () => { seeking = false; });

    demoSpeed.addEventListener('change', () => {
      demoVideo.playbackRate = Number(demoSpeed.value);
    });

    demoViewport.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showDemo(demoIndex - 1, !demoVideo.paused && !demoVideo.ended);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        showDemo(demoIndex + 1, !demoVideo.paused && !demoVideo.ended);
      }
      if (event.key === ' ') {
        event.preventDefault();
        toggleDemoPlayback();
      }
    });

    demoVideo.addEventListener('loadedmetadata', updateDemoTime);
    demoVideo.addEventListener('timeupdate', updateDemoTime);
    demoVideo.addEventListener('play', updatePlayButton);
    demoVideo.addEventListener('pause', updatePlayButton);
    demoVideo.addEventListener('ended', updatePlayButton);

    showDemo(demoIndex);
    updateDemoTime();
  }

})();
