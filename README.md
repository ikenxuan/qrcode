# @ikenxuan/qrcode

[![npm version](https://img.shields.io/npm/v/@ikenxuan/qrcode?color=0d9488)](https://www.npmjs.com/package/@ikenxuan/qrcode)
[![license](https://img.shields.io/npm/l/@ikenxuan/qrcode?color=2563eb)](./LICENSE)
[![docs](https://img.shields.io/badge/docs-GitHub%20Pages-0f172a)](https://ikenxuan.github.io/qrcode/)

用 Rust 写核心、编译成 WebAssembly 的二维码工具。能生成，也能扫，Node 和浏览器共用一套 API。

下面这些图都是这个库直接生成的，没有后期加工。

## 看看效果

### 标准二维码

<table>
  <tr>
    <td align="center"><img src="./assets/readme/qr-gradient-dots.png" width="180" alt="渐变圆点二维码，中间嵌圆形头像" /></td>
    <td align="center"><img src="./assets/readme/qr-warm-rounded.png" width="180" alt="暖色圆角点阵二维码" /></td>
    <td align="center"><img src="./assets/readme/qr-midnight.png" width="180" alt="深色圆形二维码，渐变点阵" /></td>
    <td align="center"><img src="./assets/readme/qr-classic-logo.png" width="180" alt="经典方点二维码，中间嵌圆形头像" /></td>
  </tr>
  <tr>
    <td align="center">渐变圆点、圆角定位角、头像 Logo</td>
    <td align="center">暖色圆角点阵</td>
    <td align="center">深色圆形码、渐变点阵</td>
    <td align="center">经典方点、圆角 Logo</td>
  </tr>
  <tr>
    <td align="center"><img src="./assets/readme/qr-extra-rounded.png" width="180" alt="超圆角渐变点阵二维码" /></td>
    <td align="center"><img src="./assets/readme/qr-classy.png" width="180" alt="蓝色经典点阵二维码" /></td>
    <td align="center"><img src="./assets/readme/qr-mono.png" width="180" alt="纯黑方点二维码" /></td>
    <td align="center"><img src="./assets/readme/qr-lime.png" width="180" alt="绿色双色渐变二维码" /></td>
  </tr>
  <tr>
    <td align="center">超圆角点阵、渐变</td>
    <td align="center">经典点阵、冷色调</td>
    <td align="center">纯黑方点、无 Logo</td>
    <td align="center">方形点阵、双色渐变</td>
  </tr>
</table>

### 抖音码

<table>
  <tr>
    <td align="center"><img src="./assets/readme/dy-classic.png" width="180" alt="官方版式抖音码，右上角有圆形图片" /></td>
    <td align="center"><img src="./assets/readme/dy-ring-center.png" width="180" alt="圆环外圈抖音码，中心是风景图片" /></td>
    <td align="center"><img src="./assets/readme/dy-gear.png" width="180" alt="齿轮外圈抖音码" /></td>
    <td align="center"><img src="./assets/readme/dy-spark.png" width="180" alt="长短弧外圈抖音码，暖色背景" /></td>
  </tr>
  <tr>
    <td align="center">官方版式、右上角图片</td>
    <td align="center">圆环外圈、中心图片</td>
    <td align="center">齿轮外圈、胶囊模块</td>
    <td align="center">长短弧外圈、暖色背景</td>
  </tr>
  <tr>
    <td align="center"><img src="./assets/readme/dy-dashes.png" width="180" alt="断续弧段外圈抖音码" /></td>
    <td align="center"><img src="./assets/readme/dy-dots.png" width="180" alt="圆点串外圈抖音码，棕色" /></td>
    <td align="center"><img src="./assets/readme/dy-double.png" width="180" alt="双层圆环抖音码，中心是风景图片" /></td>
    <td align="center"><img src="./assets/readme/dy-orbit.png" width="180" alt="双轨圆点外圈抖音码，紫色" /></td>
  </tr>
  <tr>
    <td align="center">断续弧段</td>
    <td align="center">圆点串</td>
    <td align="center">双层圆环、中心图片</td>
    <td align="center">双轨圆点、胶囊模块</td>
  </tr>
</table>

## 能做什么

标准二维码和抖音码都能生成，也能识别。点阵、定位角、颜色、渐变、背景、Logo 和整体形状都可以调；抖音码还能换外圈样式、右上角图片和中心图片。输出 PNG、JPEG、WebP、SVG。

WASM 已经内联进包里，import 就能用，生成和识别都在本地完成。

## 安装

```bash
pnpm add @ikenxuan/qrcode
```

## 先跑起来

```ts
import { readFileSync } from 'node:fs'
import { generate, generateDy, scan } from '@ikenxuan/qrcode'

const avatar = readFileSync('./avatar.png')

const png = await generate({
  data: 'https://example.com',
  size: 420,
  dotsOptions: {
    dotType: 'dots',
    gradient: { colorFrom: '#0d9488', colorTo: '#2563eb' },
  },
  backgroundOptions: { color: '#f8fafc' },
}, 'png')

const dy = await generateDy({
  data: 'https://bing.com',
  frameStyle: 'ring',
  centerImage: avatar,
})

const text = await scan(png)
```

同步版本是 `generateSync`、`generateDySync`、`scanSync`。浏览器用 `@ikenxuan/qrcode/browser`，方法名一样，返回 Promise，计算放在 Web Worker 里跑。

## 文档

完整文档在 https://ikenxuan.github.io/qrcode/ ，包含所有选项、类型定义和在线调试台。调试台里的参数改了会实时重绘，也能直接复制对应的 Node、React、Vue 代码。

## 项目结构

```
packages/
├── wasm/   Rust 核心，wasm-pack 编译
├── core/   TypeScript 封装，发布为 @ikenxuan/qrcode
└── docs/   文档站，静态导出后部署到 GitHub Pages
```

## 开发

```bash
pnpm install
pnpm build:wasm
pnpm build:core
pnpm docs:dev
```

`build:core` 会跑类型检查和测试。改了 Rust 代码要先重新 `build:wasm`，文档站的 playground 才能用上新构建。

## License

MIT
