<p align="center">
  <a href="https://vawe.dev"><img alt="vawe：写一个 HTML 页面，得到一个 mp4" src="assets/banner.png" width="100%"></a>
</p>

<p align="center">
  <a href="https://github.com/vawe-hq/vawe/blob/main/LICENSE"><img src="https://img.shields.io/github/license/vawe-hq/vawe?style=flat" alt="许可证"></a>
  <a href="https://github.com/vawe-hq/vawe/stargazers"><img src="https://img.shields.io/github/stars/vawe-hq/vawe?style=flat" alt="GitHub star 数"></a>
  <a href="https://github.com/vawe-hq/vawe/commits/main"><img src="https://img.shields.io/github/last-commit/vawe-hq/vawe?style=flat" alt="最近一次提交"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen?style=flat" alt="Node.js 22 或更高版本"></a>
  <a href="https://github.com/vawe-hq/skills"><img src="https://img.shields.io/badge/skills-npx%20skills%20add%20vawe--hq%2Fskills-black?style=flat" alt="安装 vawe skills：npx skills add vawe-hq/skills"></a>
</p>

<p align="center"><b>写一个 HTML 页面，得到一个 mp4。</b></p>

<p align="center">
  <a href="https://vawe.dev">vawe.dev</a> |
  <a href="https://vawe.dev/docs">文档</a> |
  <a href="https://github.com/vawe-hq/vawe/discussions">讨论区</a> |
  <a href="https://github.com/vawe-hq/skills">Skills</a>
</p>

# vawe：面向编程智能体的 HTML 转视频工具

[English](README.md) | 简体中文 | [日本語](README.ja.md)

vawe 是一个开源的 HTML 转视频框架，用于智能体原生的动态图形：输入一个 HTML 页面，输出一部影片。
它把视频和动态图形当作代码来写，是 Remotion、HyperFrames 和 Motion Canvas 的免费替代品，
设计目标是让编程智能体（Claude Code、Codex、Cursor）来写影片。
页面就是普通的 HTML、CSS、Web Animations、SVG、canvas 或 three.js。渲染器在 Chrome 中逐帧定位（seek）
页面，离线混合其中的 `<audio>` 标签，并编码出一个确定性的 mp4。

网站和文档：[vawe.dev](https://vawe.dev)。给 AI 智能体看的入口：[vawe.dev/ai-agents](https://vawe.dev/ai-agents)
或 [llms.txt](https://vawe.dev/llms.txt)。

![一个 vawe 页面渲染成影片](assets/vawe-demo.gif)

## 快速开始

```bash
npm install @vawe/cli
npx vawe new my-film --request "a 10 second title card"
npx vawe dev films/my-film/page.html
```

需要 Node 22+，并且 ffmpeg 在 PATH 中。影片放在 `films/`，mp4 放在 `out/`，都在你运行命令的目录下。
第一次渲染会下载一次 Chrome（约 150 MB）。包名是 `@vawe/cli`，命令是 `vawe`。`npx vawe --help` 会列出所有子命令。文档里的 `bin/vawe`
请读作 `npx vawe`。

从源码运行（用于开发 vawe 本身）：

```bash
git clone https://github.com/vawe-hq/vawe.git && cd vawe
npm install                                  # Node 22+; ffmpeg must be on PATH
npx puppeteer browsers install chrome        # bin/vawe-dev doctor prints this and every other missing tool
bin/vawe new hello --request "a 10 s sting for a coffee brand"
# then run the next: line that each command prints (AGENTS.md is the map)
```

## Studio：手动修改影片

```bash
bin/vawe dev films/<name>/page.html --studio    # open the printed address
```

这是针对单个页面的实时编辑器：可以拖动播放头预览影片、在时间轴上拖动关键帧、修改颜色和文字、切换画幅比例。
每次修改都是对 `page.html` 的文本补丁，所以智能体可以继续在同一个文件上工作。更多内容见
[vawe.dev/studio](https://vawe.dev/studio) 和 `studio/README.md`。

![vawe studio：预览画面、关键帧时间轴和 Key 面板](https://vawe.dev/studio/studio-main.webp)

## 用 vawe 做的影片

每部影片就是一个 `page.html`。点击静帧即可播放 mp4。

| | |
|---|---|
| [![showcase：黑色背景上，用发光的金色粒子画出的鹦鹉螺壳](https://vawe.dev/examples/showcase.webp)](https://vawe.dev/examples/showcase.mp4) | [![CINDRE：黑色背景上，一朵柔光构成的红色莲花缓缓绽放，一支香水影片](https://vawe.dev/examples/cindre.webp)](https://vawe.dev/examples/cindre.mp4) |
| **showcase**，14 秒：一个页面渲染成 16:9、9:16、1:1、4:5 和 4:3 | **CINDRE**，10 秒：一支香水影片，一个页面 |
| [![tracking HUD：文字 "every frame" 配有跟踪框、色散边缘和扫描线，背景是一片坐标](https://vawe.dev/examples/tracking-hud.webp)](https://vawe.dev/examples/tracking-hud.mp4) | [![retro remix：绿色山坡上的桌面窗口，写着 learn After Effects、buy a template、hire a studio、keyframe for 3 days](https://vawe.dev/examples/retro-remix.webp)](https://vawe.dev/examples/retro-remix.mp4) |
| **tracking HUD**：透过镜头着色器拍摄的屏幕（`films/examples/tracking-hud/`） | **retro remix**：桌面窗口风格的混剪 |

更多：超过 120 个可直接复制的动作（move），每个都带一段视频，见 [vawe.dev/moves](https://vawe.dev/moves)
和 `prompts/moves/README.md`。

## 工作原理

### 一部影片就是一个 HTML 页面

```html
<!doctype html>
<meta name="duration" content="6">
<meta name="message" content="one page, one film">
<style>
  body { margin: 0; background: #0b0d12; color: #f4f6fb; font: 700 calc(var(--vh) * 0.08) system-ui; }
  h1 { position: absolute; left: 8%; top: 40%; animation: rise 0.6s var(--ease-land) both 0.4s; }
  @keyframes rise { from { transform: translateY(40px); opacity: 0 } to { transform: none; opacity: 1 } }
</style>
<h1>one page, one film</h1>
<audio data-synth="chime" data-at="0.4" data-gain="-6"></audio>
```

- `<meta name="duration">` 是以秒为单位的时长。其余的都是你已经熟悉的东西。
- 时间就是 seek。CSS `@keyframes` 和 `element.animate()` 会被暂停，并由 `currentTime` 驱动；
  也可以定义 `window.seek(t)`，把第 t 帧画成 t 的纯函数。
- 在任何页面脚本运行之前，渲染器会安装一个虚拟时钟（`Date`、`performance.now`、
  `requestAnimationFrame`、定时器和带种子的 `Math.random` 都跟随 seek）。它还会设置
  `<html data-aspect>`、`--vw`/`--vh` 和 `window.vawe`，所以同一个页面可以适配 `16:9 9:16 1:1 4:5 4:3`
  （`bin/vawe ship <page> --aspect all` 会渲染全部画幅）。
- 命名的缓动曲线也是 CSS 变量：用 `var(--ease-land)` 表示进入，用 `var(--ease-launch)` 表示退出。
  渲染器和 studio 会设置它们；普通浏览器不会，所以在那里页面会直接显示结束状态，没有动画。
- 音频使用 `<audio>` 标签，配合 `data-at`、`data-gain` 和 `data-fade-out`。`loop` 标记用户提供的音乐文件。
  `data-synth` 从 `core/audio/kit.mjs` 中选一个备用的音效声音（优先使用录制的音效）。混音在离线时完成，
  按你写的来；`<meta name="loudness">` 可以选择启用目标响度。
- 弹簧、关键帧表和带种子的噪声：`core/motion/springs.js`（`core/motion/README.md`）。

完整的约定，以及初稿常犯的错误，见 `skills/vawe-page/SKILL.md`。在上面的例子里，这行字在淡入的同时上升 40 px，
停留足够长的时间供人阅读，提示音与动作同时落下。

### 工作流程

```
brief -> reference study -> design and kit -> key frames -> board -> draft -> motion pass
      -> critique in a FRESH session -> fix the named seconds -> owner approval -> final
```

`bin/vawe` 是唯一的命令。核心子命令（`bin/vawe --help`；`--help --all` 列出全部子命令）：

| verb | 作用 |
|---|---|
| `new` | 开始一部影片：写出 `page.html` 和 `brief.md`，并先询问缺失的信息 |
| `refs`, `see` | 研究参考影片，并把一部影片读成数字：镜头、动作、光线、字体、声音 |
| `frame` | 各种画面：单帧、联系表、每个 world 的关键状态、一次切换、一个动作、一次缩放、一块 HTML 看板 |
| `dev` | 草稿：半尺寸，30 fps |
| `critique` | 为没有写这个页面的会话生成手机预览表、条带、循环接缝和页面检查 |
| `ship`, `wait` | 最终渲染：60 fps，带运动模糊和混好的音频；`wait` 等待任意渲染完成 |
| `sound`, `check` | 声音、节拍网格和提示音；一个具名的检查关卡（`anim-traps`、`page-check`、`doc-refs` 等） |

每个子命令都会打印一行 `next:`，给出下一条命令。评审默认拒绝，并把每个问题写成镜头、帧和修复方法
（`skills/vawe-critique/SKILL.md`）。参考影片通过 `SPEC.md` 和一份 KEEP 或 CHANGE 清单来匹配
（`skills/vawe-reference/SKILL.md`）。每种影片类型有一个提示词模板：`guides/ROUTING.md`。

### 确定性

每一帧都是它 seek 时间的纯函数：没有系统时钟，帧之间不保留状态，没有不带种子的随机数。
这让渲染器可以在多个浏览器页面上同时抓帧，用分数子帧做模糊，并且只重新渲染评审点名的那几秒。
`bin/vawe check anim-traps <page>` 会找出 seek 式 CSS 动画在不报错的情况下失效的七种情形。
更多内容：[vawe.dev/determinism](https://vawe.dev/determinism)。

## 在你的智能体里使用

- Codex、Cursor 和其他智能体读取 `AGENTS.md`：安装步骤、硬性规则、工作流程和文档索引。
  Claude Code 读取 `CLAUDE.md`，它指向 `AGENTS.md`。
- `skills/` 存放智能体按阶段加载的 skills：`html-to-video`（从这里开始）、`vawe-brief`、
  `vawe-page`、`vawe-critique`、`vawe-transitions`、`vawe-reference`。任何智能体都能读取
  `SKILL.md`。这些 skills 调用 `vawe` 命令：`npx vawe` 在任何地方都能用，在检出的仓库里用 `bin/vawe`。
  有两种安装方式：

  ```bash
  npx skills add vawe-hq/skills
  claude plugin marketplace add vawe-hq/skills
  claude plugin install vawe@vawe-skills
  ```

  第一行适用于 `skills` CLI 支持的任何智能体。后两行用于 Claude Code。
  [vawe-hq/skills](https://github.com/vawe-hq/skills) 是 `skills/` 的一个小型副本，由工作流保持同步，
  所以安装时不会下载整个仓库。
- 用日常语言向你的智能体提出想要的影片。它会运行 `bin/vawe new <name> --request "<the ask>"`，
  并按 `next:` 行继续往下做。

## 安装

从源码安装：Node 22+、git、ffmpeg（需带 libx264 和 drawtext），以及 tesseract（可选，用于 OCR）。

```bash
npm install
bin/vawe-dev doctor
bin/vawe dev films/<name>/page.html
```

`bin/vawe-dev doctor` 会检查每个工具，并为缺失的工具打印适合你系统（macOS、Linux 或 Windows）的安装命令。
只有缺少必需工具时它才会以退出码 1 结束。如果某个子命令因为缺少 Chrome 而失败，它会打印同样的安装命令。
在使用不同 GPU 或不同 Chrome 版本做光栅化的机器之间，输出可能不同。

## 架构

```
  films/<name>/page.html            the film: HTML · CSS · WAAPI · seek(t) · <audio> · assets/
          │
          ▼
  harness/media/render-page.mjs     virtual clock (core/engine/page-clock.js) · aspect vars ·
          │                         seek every frame on N browser pages · subframe blur
          ▼
  ffmpeg                            frames -> H.264, one pass
          │
          ▼
  harness/media/page-audio.mjs      <audio> tags -> one offline mix (synth voices: core/audio/kit.mjs)
          │
          ▼
  out/<name>[-<aspect>][-draft].mp4
```

```
core/motion/       springs.js (spring, track, approach, kf, springLinear, rng, noise1), curves.js
core/engine/       page-clock.js (the virtual clock), page-api.js (vawe.onFrame, three.js helpers)
core/audio/        kit.mjs: the synth voices
bin/               vawe: the one command; --help lists the verbs
harness/cli/       the verb table and argument parser behind it
harness/media/     render-page.mjs · page-audio.mjs · see.mjs (the views) · ref-spec.mjs · review.mjs
quality/gates/     page-check.mjs · anim-traps.mjs · judge.mjs · doc-refs.mjs
prompts/           one template per film type, and prompts/moves/ (moves to copy, with clips)
skills/            html-to-video (start here) · vawe-brief · vawe-page · vawe-critique · vawe-reference · vawe-transitions
taste/             rules/ (one rule per file) · craft/ · build/ (generated) · README.md (the index)
guides/            engine and process guides (ROUTING.md picks a film type) · judge.md
films/             <name>/page.html per film; films/examples/ holds the reference films
out/               rendered mp4s (gitignored)
```

## 文档

- [vawe.dev](https://vawe.dev)：网站，另有 [features](https://vawe.dev/features)、[moves](https://vawe.dev/moves)、
  [blog](https://vawe.dev/blog)、[Remotion alternatives](https://vawe.dev/remotion-alternatives) 和
  [HyperFrames alternatives](https://vawe.dev/hyperframes-alternatives)。
- 仓库内：`AGENTS.md`（导览）、`guides/ROUTING.md`（影片类型）、`prompts/moves/README.md`、
  `core/motion/README.md`、`taste/README.md`（所有审美规则；`taste/build/DIGEST.md` 是最先要读的）
  和 `guides/judge.md`（影片如何打分）。

## 常见问题

**vawe 是什么？** 一个面向“代码化动态图形”的 HTML 转视频渲染器和工作流。你或你的智能体写一个 HTML 页面；
`bin/vawe ship` 把它变成 mp4。

**它和 Remotion 有什么不同？** 没有 React 组件树，也没有要学习的时间轴 API。页面使用 CSS 动画、
Web Animations 或一个 `window.seek(t)` 函数，渲染器按 seek 时间驱动它们。
对比见：[vawe.dev/remotion-alternatives](https://vawe.dev/remotion-alternatives)。

**支持哪些智能体？** 任何能读文件并运行 shell 命令的智能体。Claude Code 读取 `CLAUDE.md`；
Codex、Cursor 等读取 `AGENTS.md`。

**输出是确定性的吗？** 是。同一个页面以任意帧顺序渲染都会得到相同的帧，因为虚拟时钟取代了 `Date`、定时器、
`requestAnimationFrame` 和 `Math.random`。

**支持哪些格式和画幅比例？** H.264 mp4，一个页面可输出 16:9、9:16、1:1、4:5 和 4:3。

**可以用 GSAP、three.js 或 canvas 吗？** 可以：任何根据 seek 时间绘制的东西都行。`vawe.onFrame`
和 three.js 辅助函数见 `core/engine/page-api.js`。

**可以免费商用吗？** 可以，采用 Apache License 2.0。

## 状态与许可证

vawe 仍在积极开发中，以 [Apache License 2.0](LICENSE) 发布：可以出于任何目的免费使用、修改和分发，
包括生产和商业用途。[LICENSE](LICENSE) 有完整文本和专利授权；[NOTICE](NOTICE) 有第三方声明。
欢迎贡献代码和提交 issue（`CONTRIBUTING.md`）。

---

本文是译文。如有出入，以英文版 [README.md](README.md) 为准。
