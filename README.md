<p align="center">
  <img src="icon.png" width="116" alt="Coco">
</p>

<h1 align="center">Coco</h1>

<p align="center">A fast, native macOS launcher. One hotkey for apps, clipboard, math, and more.</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/dynamic/xml?url=https%3A%2F%2Fbutterflydream-ai.github.io%2Fcoco-app%2Fappcast.xml&query=%2F%2F%2A%5Blocal-name()%3D%27shortVersionString%27%5D%5B1%5D&prefix=v&label=Coco&color=2e7d32">
  <img alt="Platform" src="https://img.shields.io/badge/macOS%2014%2B-Apple%20Silicon-2e7d32">
  <img alt="Auto-update" src="https://img.shields.io/badge/auto--update-Sparkle-2e7d32">
</p>

<p align="center">
  <a href="https://coco.butterflydream.ai/Coco-macos.dmg"><b>⬇&nbsp; Download for macOS</b></a>
  &nbsp;·&nbsp; <a href="#install">Install</a>
  &nbsp;·&nbsp; <a href="#中文">中文</a>
</p>

---

<p align="center">
  <img src="shot-launcher.jpg" width="780" alt="Coco launcher">
</p>

Coco lives in your menu bar and stays out of the way until you press **⌥Space**. Then it's right there: launch an app, paste from clipboard history, do quick math, convert units or currency, drop an emoji, run a saved command.

Written in Swift + AppKit. Around 2&nbsp;MB, instant to summon, no Electron.

## Features

- **App launcher** — fuzzy search with pinyin / romaji / Hangul-initial matching, plus per-app actions.
- **Clipboard history & favorites** — searchable, Space to preview, paste straight back into the app you came from.
- **Calculator & conversion** — arithmetic, units, live currency rates.
- **Emoji & web search** — grab an emoji, or send a query to your search engine.
- **Shell command aliases** — bind your own commands and fire them from the bar.
- **Plugins & Coco Store** — browse and install JS plugins in-app.
- **Four languages** — English, 简体中文, 日本語, 한국어, following your system.
- **Silent auto-update** — new versions download and install themselves.

## In action

<p align="center">
  <img src="shot-currency.jpg" width="420" alt="Type $100, get live conversions">
  &nbsp;
  <img src="shot-calc.jpg" width="420" alt="Inline calculator">
</p>

<p align="center"><sub>Type an amount for live currency rates, or any expression for a quick answer.</sub></p>

## Install

1. [Download the DMG](https://coco.butterflydream.ai/Coco-macos.dmg) (or the [zip](https://coco.butterflydream.ai/Coco-macos.zip)).
2. Drag **Coco** into **Applications**.
3. First launch: right-click Coco → **Open**. The build is ad-hoc signed, so Gatekeeper asks once.
4. Press **⌥Space**. The first run walks you through the couple of permissions it needs.

**Requirements:** macOS 14+ on Apple Silicon.

After that Coco keeps itself current — no need to come back here.

## Shortcuts

| Action | Default |
| --- | --- |
| Launcher | ⌥Space |
| Clipboard history | ⇧⌘V |
| Preview item | Space |
| Open / run / paste | ↩ |

All rebindable in Settings.

## 中文

Coco 是一个原生 macOS 启动器，常驻菜单栏，按 **⌥Space** 唤出：搜应用、翻剪贴板历史、算个数、换算单位汇率、找 emoji、跑自定义命令。Swift + AppKit 写的，约 2&nbsp;MB，不吃内存。

- 应用搜索支持拼音 / 罗马音 / 韩文初声，含逐应用动作
- 剪贴板历史 + 收藏，空格预览，一键粘回原应用
- 计算器、单位换算、实时汇率、Emoji、网页搜索、Shell 命令别名
- JS 插件 + 内置 Coco Store
- 中 / 英 / 日 / 韩四语，跟随系统
- 静默自动更新

[下载 DMG](https://coco.butterflydream.ai/Coco-macos.dmg) → 拖进「应用程序」→ 首次右键「打开」→ 按 ⌥Space。需 macOS 14+ Apple Silicon。

## Author

Built by **YAN** · [@yan_ai_labs](https://x.com/yan_ai_labs)
