# BeyondRetarget Plus 项目网页说明及使用指南

这是 BeyondRetarget Plus 的完整静态项目主页。网页、样式、脚本和全部视频均保存在本目录中，不依赖后端、数据库、远程视频链接或第三方前端库。

项目完整标题为 **BeyondRetarget Plus: Data Engine for Generating Robot Motion Data from Internet-Scale Human Videos**。Base 版面向实时单目视频重定向与遥操作；Plus 版增加全局轨迹建模和移动相机支持，提升泛化与运动重建表现，用于离线生成机器人动作数据。网站资源按钮及两边的代码 README 提供版本互链。

## 1. 直接预览

直接用现代浏览器打开 `index.html` 即可查看。

为了获得更稳定的视频加载和播放体验，建议在本目录启动静态 HTTP 服务：

```bash
cd /home/tianyu/code/BR_plus_web
python3 serve.py
```

在服务器本机浏览器访问 `http://127.0.0.1:8000/`；在个人电脑上通过下面的 SSH 端口转发访问。服务默认只监听服务器本机，支持视频所需的 HTTP Range 分段请求。

如在个人电脑上使用 SSH 端口转发：

```bash
ssh -L 8000:localhost:8000 citelab_s4
```

保持该 SSH 连接，并在服务器另开终端运行上述 HTTP 服务，然后访问 `http://localhost:8000/`。

停止服务时，在运行服务的终端按 `Ctrl+C`。Windows 也可以运行 `py serve.py`。

## 2. 复刻和部署

本目录就是完整发布包，无需 npm、编译、安装依赖或执行构建命令。

### 复制到其他目录或服务器

完整复制本目录中的所有内容，并保留相对目录结构：

```bash
scp -r /home/tianyu/code/BR_plus_web 用户名@目标服务器:/目标路径/
```

目标服务器只需提供静态文件访问能力。

### Nginx

将站点根目录指向本文件夹，例如：

```nginx
server {
    listen 80;
    server_name your-domain.example;
    root /home/tianyu/code/BR_plus_web;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

### GitHub Pages

本地 Git 仓库的 `origin` 为 <https://github.com/bear-ty/BR_plus_web.git>。计划发布地址为 <https://bear-ty.github.io/BR_plus_web/>；目前仅配置远程地址，尚未提交、推送或部署。

把本目录中的**全部内容**上传到仓库根目录，在仓库设置中启用 GitHub Pages。无需设置构建命令或输出目录。

`.nojekyll` 用于禁用 Jekyll 处理，请一并保留。

## 3. 文件结构

```text
BR_plus_web/
├── index.html                 # 页面结构、文字、链接及视频配置
├── styles.css                 # 页面布局、响应式样式和动画
├── script.js                  # 缩略图、视频懒加载、导航及演示播放器交互
├── serve.py                   # 本地预览服务，支持 Range 分段请求
├── prepare_media.py           # 可重复执行的视频与缩略图准备脚本
├── .nojekyll                  # GitHub Pages 配置
├── README.md                  # 本说明及使用指南
├── MANIFEST.sha256            # 文件完整性校验清单
└── assets/
    ├── cover/                 # 16 个完整时长、原始帧率的封面压缩版
    ├── posters/               # 16 张封面缩略图及 2 张失败案例缩略图
    └── videos/                # 18 个完整原视频，仅做无损 faststart
        ├── ballet-2.mp4
        ├── failure-figure-skating.mp4
        ├── failure-gymnastics.mp4
        ├── headset.mp4
        ├── jump-rope.mp4
        ├── mc-dance-1.mp4
        ├── mc-dance-2.mp4
        ├── new-1.mp4
        ├── new-4.mp4
        ├── new-5.mp4
        ├── new-6.mp4
        ├── new-8.mp4
        ├── new-10.mp4
        ├── new-12.mp4
        ├── skating.mp4
        ├── sunset-dance.mp4
        ├── tennis-1.mp4
        └── vault.mp4
```

保留全部 18 个完整原视频。保留 16 个封面压缩版文件，当前精简后的封面引用首屏出现的 12 种视频；下方演示与 Failure Case 使用完整原视频。演示第 02 项为 `side flip`，对应 `assets/videos/new-8.mp4`。

## 4. 页面内容

1. 全屏多列动态视频墙及项目简称
2. 论文标题、作者、单位及项目链接
3. 8 个演示视频，支持翻页、进度拖动、暂停、重新播放和倍速
4. Teleoperation Video 占位区域
5. Abstract
6. Approach 翻转卡片
7. Failure Case 视频
8. BibTeX 引用

## 5. 常见修改

### 修改文字或外部链接

编辑 `index.html`。作者主页、GitHub、Hugging Face 和 `base version` 链接都集中在论文信息区域；版本入口与 GitHub 等资源并排显示为可点击按钮，通过 base 网站可进一步访问 base 代码。

### 替换视频

推荐把新视频复制到 `assets/videos/`，再修改 `index.html` 中对应的相对路径：

```html
<source src="assets/videos/your-video.mp4" type="video/mp4">
```

演示分页通过 `data-video` 指定完整原视频。演示第一个视频和 Failure Case 保留原生 `src`，使用 `preload="metadata"` 和缩略图，保证刷新后可直接播放，不依赖滚动观察器赋值。替换原视频后，需要将对应旧的封面压缩版和缩略图移走，再运行下方准备脚本重新生成。新增封面视频还需要更新 `prepare_media.py` 的 `COVER_NAMES` 和原视频数量检查。修改文件后，应重新生成 `MANIFEST.sha256`。

### 修改演示视频分页

演示视频分页位于 `index.html` 的 `demo-pagination` 区域。每个按钮通过 `data-video` 指定视频：

```html
<button class="demo-page" type="button"
        data-video="assets/videos/your-video.mp4"
        aria-pressed="false">
  09<span>Video Name</span>
</button>
```

播放器会自动读取全部分页，不需要修改 `script.js`。若改变分页数量，可同时调整 `styles.css` 中 `.demo-pagination` 的列数。

### 修改首屏视频墙

首屏视频墙位于 `index.html` 的 `dataset-wall` 区域。每个 `wall-column` 表示一列，每个 `wall-tile` 表示一个视频画面。

每个封面 video 的 `poster` 指向 `assets/posters/`，source 的 `data-src` 指向 `assets/cover/`；保留 `preload="none"`，不要添加 `autoplay` 或直接的 source `src`。脚本会添加静态图片遮罩，并在短暂的首屏展示阶段后逐个启动可见视频。每张缩略图独立处理，并有 1.5 秒等待上限；任何一张图片卡住都不会阻止其他视频播放。首帧可显示后才移除对应图片遮罩。

视频及图片通过 `object-fit: contain` 完整显示。当前保留 5 列首屏排布，HTML 从 80 个位置缩减到 27 个基础位置，引用 12 种首屏视频。脚本按列的实际高度补足有限循环缓冲，并将完整移出顶部的视频块移回底部，连续向上缓慢滚动（约每秒 5–6 像素）。不会随着滚动不断增加元素；1440×900 下包括缓冲在内共约 43 个位置。手机/平板按窗口调整列数和缓冲。调整排布时，请同时检查横向和纵向相邻重复，以及窗口比例和倾斜裁剪产生的边缘空隙。

## 6. 权限设置

服务器目录已设置为允许读、写和进入目录。如需重新设置：

```bash
chmod -R a+rwX /home/tianyu/code/BR_plus_web
```

其中大写 `X` 只为目录和已有可执行文件增加进入/执行权限，不会把普通网页和视频错误地标记为可执行程序。

## 7. 完整性检查

在本目录运行：

```bash
cd /home/tianyu/code/BR_plus_web
sha256sum -c MANIFEST.sha256
```

全部显示 `OK` 表示发布文件与整理时的版本一致。

## 8. 外部链接说明

网页本身不需要联网即可加载。以下链接仅在用户点击时访问外部网站：

- Plus 网站计划地址：<https://bear-ty.github.io/BR_plus_web/>。目前尚未发布；本次仅在本地写入该地址，部署后互链才会生效。
- Plus 代码：<https://github.com/bear-ty/BeyondRetarget_plus>
- Base 网站（`base version` 按钮）：<https://bear-ty.github.io/Beyondretarget_page/>
- 作者个人主页：见 `index.html` 中对应链接

Hugging Face 按钮目前仍是占位链接，获得正式地址后可直接在 `index.html` 中替换。


## 9. 视频准备与加载优化

网站发布文件已经准备好，直接预览或部署不需要 FFmpeg。只有重新处理媒体时才需要安装带 `libx264` 的 FFmpeg，Python 脚本本身不需要额外包。

```bash
cd /home/tianyu/code/BR_plus_web
python3 prepare_media.py --ffmpeg /absolute/path/to/ffmpeg
```

也可以在 FFmpeg 已加入 PATH 时运行 `python3 prepare_media.py`，或通过 `FFMPEG` 环境变量指定路径。

脚本会按顺序处理文件，每个压缩任务最多使用两个编码线程：

1. 对 `assets/videos/` 中的原视频做 `-map 0 -c copy -movflags +faststart`，只调整容器索引位置，不重新编码音视频。
2. 对封面使用的视频生成完整时长、原始帧率的 H.264 压缩版，CRF 24，分辨率限制在约 1280×720 范围内；保持比例、不裁剪、不放大、不降帧、不截短，去除封面不需要的音轨。
3. 从封面压缩版及两个失败案例首帧生成最高约 640 像素宽的 JPEG 缩略图。

已有 faststart 原视频和有效的封面/图片输出会被跳过。新文件先写入同目录临时文件，成功后再替换，避免处理中断损坏文件。

当前 16 个封面原片合计约 255 MiB，压缩版合计约 35.8 MiB，缩略图合计约 0.38 MiB。完整原视频仍然保留。

封面加载行为：

- 所有位置先显示静态缩略图，视频首帧就绪后再显露视频。
- 只在接近可见范围时绑定封面视频地址，仅在可见时播放。
- 手机通过 CSS 隐藏的列不绑定或播放视频；标签页隐藏时暂停。
- 启用系统“减少动态效果”时，停止列的空间滚动，静音视频仍能正常播放。
- 如果浏览器禁止自动播放，会显示 `Play videos` 按钮以允许用户启动封面。
- 下方演示第一个视频刷新时即完成地址初始化；Failure Case 有独立缩略图和原生视频地址，使用 metadata 预加载，不依赖滚动事件。
- 本地预览 HTML/CSS/JS 使用 no-store，发布入口还通过内容版本号引用样式/脚本，避免新旧代码缓存混用。以后修改样式或脚本时，也应更新 `index.html` 中对应链接的版本号。

`serve.py` 仅供本地预览；GitHub Pages / Nginx 直接提供静态文件即可。GitHub Pages 不会执行 Python，也不需要运行这两个脚本。上传时保留完整目录结构和 `.nojekyll`。当前最大文件约 34.84 MiB，适合使用 Git 或 GitHub Desktop 上传；浏览器上传单文件限制为 25 MiB。

修改或重新生成文件后，可用以下命令更新完整性清单（不包含清单本身）：

```bash
python3 - <<'PY_MANIFEST'
from pathlib import Path
import hashlib
root = Path('.')
files = sorted(p for p in root.rglob('*') if p.is_file()
               and p.name != 'MANIFEST.sha256'
               and '__pycache__' not in p.parts
               and '.git' not in p.parts)
Path('MANIFEST.sha256').write_text(''.join(
    f'{hashlib.sha256(p.read_bytes()).hexdigest()}  ./{p.as_posix()}\n'
    for p in files))
PY_MANIFEST
sha256sum -c MANIFEST.sha256
```


`new-8.mp4` 已裁剪为原片的第 4–18 秒，视频画面共 14 秒、420 帧，保持 30fps；对应封面压缩版和缩略图同步更新。演示第 02 项及封面使用裁剪后的版本，封面原有 `new-1` 位置已全部改为 `new-8`，卡片比例调整为 16:9。


2026-11-05：滑冰视频已替换为用户提供的 `skate.mp4`，沿用 `assets/videos/skating.mp4` 发布路径；完整视频保留输入画质、帧率和音轨，仅做 faststart。封面压缩版与缩略图同步更新，相关 URL 加入内容版本号。根目录的 `skate.mp4` 保留为替换源文件。
