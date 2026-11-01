#!/usr/bin/env python3
"""Prepare faststart originals, lightweight cover clips, and JPEG posters.

Requires FFmpeg with libx264. No Python packages are required. Cover clips
retain the full source duration, frame timing, and frame rate. Existing valid
outputs are skipped; every new file is written beside its destination and
atomically renamed only after FFmpeg succeeds.
"""

import argparse
import os
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile


COVER_NAMES = (
    "ballet-2.mp4",
    "headset.mp4",
    "jump-rope.mp4",
    "mc-dance-1.mp4",
    "mc-dance-2.mp4",
    "new-1.mp4",
    "new-4.mp4",
    "new-5.mp4",
    "new-6.mp4",
    "new-8.mp4",
    "new-10.mp4",
    "new-12.mp4",
    "skating.mp4",
    "sunset-dance.mp4",
    "tennis-1.mp4",
    "vault.mp4",
)


def top_level_atoms(path):
    atoms = {}
    file_size = path.stat().st_size
    with path.open("rb") as source:
        offset = 0
        while offset + 8 <= file_size:
            source.seek(offset)
            header = source.read(16)
            if len(header) < 8:
                break
            size = struct.unpack(">I", header[:4])[0]
            kind = header[4:8].decode("ascii", errors="replace")
            header_size = 8
            if size == 1:
                if len(header) < 16:
                    raise ValueError(f"Truncated extended atom in {path}")
                size = struct.unpack(">Q", header[8:16])[0]
                header_size = 16
            elif size == 0:
                size = file_size - offset
            if size < header_size or offset + size > file_size:
                raise ValueError(f"Invalid {kind} atom in {path}")
            atoms.setdefault(kind, []).append(offset)
            offset += size
    return atoms


def is_faststart(path):
    try:
        atoms = top_level_atoms(path)
        return bool(atoms.get("moov") and atoms.get("mdat")) and atoms["moov"][0] < atoms["mdat"][0]
    except (OSError, ValueError):
        return False


def temporary_output(destination):
    fd, name = tempfile.mkstemp(
        prefix=f".{destination.stem}.",
        suffix=destination.suffix,
        dir=destination.parent,
    )
    os.close(fd)
    return Path(name)


def run(command):
    subprocess.run(command, check=True)


def remux_original(ffmpeg, source):
    if is_faststart(source):
        print(f"[skip] {source.name} is already faststart", flush=True)
        return False
    print(f"[remux] {source.name} (all streams copied)", flush=True)
    temporary = temporary_output(source)
    try:
        run([
            ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(source), "-map", "0", "-c", "copy",
            "-movflags", "+faststart", str(temporary),
        ])
        if not is_faststart(temporary):
            raise RuntimeError(f"Remux did not produce faststart MP4: {source}")
        os.chmod(temporary, source.stat().st_mode & 0o777)
        os.replace(temporary, source)
    finally:
        if temporary.exists():
            temporary.unlink()
    return True


def make_cover(ffmpeg, source, destination):
    if destination.exists() and destination.stat().st_size > 0 and is_faststart(destination):
        print(f"[skip] cover {destination.name}", flush=True)
        return
    print(f"[cover] {source.name} -> {destination.name}", flush=True)
    temporary = temporary_output(destination)
    try:
        run([
            ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(source), "-map", "0:v:0",
            "-vf", r"scale=w='trunc(min(iw,min(1280,720*iw/ih))/2)*2':h=-2",
            "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "24",
            "-pix_fmt", "yuv420p", "-threads", "2", "-vsync", "0",
            "-map_metadata", "-1", "-movflags", "+faststart", str(temporary),
        ])
        if not is_faststart(temporary):
            raise RuntimeError(f"Cover is not faststart: {destination}")
        os.chmod(temporary, 0o644)
        os.replace(temporary, destination)
    finally:
        if temporary.exists():
            temporary.unlink()


def make_poster(ffmpeg, cover, destination):
    if destination.exists() and destination.stat().st_size > 0:
        print(f"[skip] poster {destination.name}", flush=True)
        return
    print(f"[poster] {cover.name} -> {destination.name}", flush=True)
    temporary = temporary_output(destination)
    try:
        run([
            ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(cover), "-map", "0:v:0", "-frames:v", "1",
            "-vf", r"scale=w='min(640,iw)':h=-2",
            "-q:v", "3", "-threads", "2", str(temporary),
        ])
        if temporary.stat().st_size == 0:
            raise RuntimeError(f"Empty poster: {destination}")
        os.chmod(temporary, 0o644)
        os.replace(temporary, destination)
    finally:
        if temporary.exists():
            temporary.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ffmpeg", default=os.environ.get("FFMPEG", "ffmpeg"))
    args = parser.parse_args()
    ffmpeg = shutil.which(args.ffmpeg) if os.sep not in args.ffmpeg else args.ffmpeg
    if not ffmpeg or not Path(ffmpeg).is_file():
        parser.error("FFmpeg not found; install it or pass --ffmpeg /absolute/path/to/ffmpeg")

    root = Path(__file__).resolve().parent
    videos = root / "assets" / "videos"
    covers = root / "assets" / "cover"
    posters = root / "assets" / "posters"
    originals = sorted(videos.glob("*.mp4"))
    if len(originals) != 18:
        raise RuntimeError(f"Expected 18 original MP4s, found {len(originals)}")
    missing = [name for name in COVER_NAMES if not (videos / name).is_file()]
    if missing:
        raise RuntimeError(f"Missing cover sources: {', '.join(missing)}")

    for source in originals:
        remux_original(ffmpeg, source)

    covers.mkdir(exist_ok=True)
    posters.mkdir(exist_ok=True)
    for name in COVER_NAMES:
        stem = Path(name).stem
        cover = covers / name
        make_cover(ffmpeg, videos / name, cover)
        make_poster(ffmpeg, cover, posters / f"{stem}.jpg")

    for name in ("failure-figure-skating", "failure-gymnastics"):
        make_poster(ffmpeg, videos / f"{name}.mp4", posters / f"{name}.jpg")

    original_bytes = sum(path.stat().st_size for path in originals)
    cover_bytes = sum(path.stat().st_size for path in covers.glob("*.mp4"))
    poster_bytes = sum(path.stat().st_size for path in posters.glob("*.jpg"))
    print(
        f"Done: originals={original_bytes} bytes, covers={cover_bytes} bytes, "
        f"posters={poster_bytes} bytes",
        flush=True,
    )


if __name__ == "__main__":
    main()
