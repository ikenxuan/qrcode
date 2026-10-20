# @ikenxuan/qrcode

基于 Rust [qr-code-styling](https://crates.io/crates/qr-code-styling) + [rxing](https://crates.io/crates/rxing) 的高性能 QR 码生成与扫描工具，同时支持抖音码（`BEF_CODE_TYPE_DY_CODE`）的生成与识别。通过 WebAssembly 提供高性能核心，Node.js import 即用。

## 安装

```bash
pnpm add @ikenxuan/qrcode
```

## 快速开始

```ts
import { generate, generateSvg, generateDy, scan } from '@ikenxuan/qrcode'

// 生成 PNG 二进制
const png = await generate({ data: 'https://example.com' }, 'png')

// 生成 base64 字符串
const b64 = await generate({ data: 'https://example.com' }, 'png', 'base64')

// 生成 SVG 字符串
const svg = await generateSvg({ data: 'https://example.com' })

// 生成抖音码 PNG（官方默认样式）
const dyPng = await generateDy({ data: 'https://v.douyin.com/utbKgTJRmlI/' })

// 扫描图片中的 QR 码 / 抖音码
const result = await scan(png) // 'https://example.com'

```

WASM 已内联，import 即用，无需初始化，无需关心 `.wasm` 文件路径。

异步 API 会通过 Node.js 的 `worker_threads` 执行，避免阻塞主线程。浏览器端请使用
`@ikenxuan/qrcode/browser` 子路径入口，它不依赖 Node.js 内置模块，并通过浏览器 Web Worker 执行 WASM 计算。

---

## API

### `generate(options, format, encoding?)`

异步生成 QR 码。

| 参数 | 类型 | 说明 |
|------|------|------|
| `options` | `QRCodeOptions` | QR 码配置 |
| `format` | `OutputFormat` | 输出格式 |
| `encoding` | `'binary' \| 'base64'` | 编码方式，默认 `'binary'` |

返回值为 `Promise`，resolve 后根据 `encoding` 自动推导类型：
- `'binary'`（默认）→ `Uint8Array`
- `'base64'` → `string`

### `generateSvg(options)`

异步生成 SVG 字符串，返回 `Promise<string>`。

### `generateDy(options, format?, encoding?)`

异步生成抖音码。抖音码（`BEF_CODE_TYPE_DY_CODE`）是抖音平台下发的圆形码，
默认参数复刻官方作品分享码版式：深色中心圆盘、四条数据环、三个定位圆环、
外圈装饰和中心播放图标。支持 PNG、WebP、JPEG 和 SVG。

| 参数 | 类型 | 说明 |
|------|------|------|
| `options` | `DyCodeOptions` | 抖音码配置 |
| `format` | `OutputFormat` | 输出格式，默认 `'png'` |
| `encoding` | `'binary' \| 'base64'` | 编码方式，默认 `'binary'` |

默认布局使用 RS(52,40)，UTF-8 文本最多 **38 字节**。生成的图片可以直接被 `scan`
解回原文；右上角 315° 的图片槽位默认留空，传入 `badgeImage` 后自动裁成圆形。
`transparent` 在 PNG / WebP / SVG 中保留透明通道，JPEG 会填充白色。
外圈位于数据环之外，可以用 `frameStyle` 换成 `arcs`、`ring`、`dashes`、`dots`、
`ticks`、`double`、`segments`、`spark`、`orbit` 或 `gear`，并用 `frameWidth` /
`frameRadius` / `frameSpan` / `frameCount` 继续调整；圆环类样式会在定位环和右上角
图片处自动断开。`centerImage` 可以用图片覆盖整个中心圆盘并替代播放图标。
需要 SVG 字符串时使用 `generateDySvg(options)`。

```ts
const png = await generateDy({
  data: 'https://v.douyin.com/utbKgTJRmlI/',
  size: 400,
  darkColor: '#161823',
  transparent: false,
  moduleStyle: 'rounded',
  moduleRadius: 1.2,
  frameStyle: 'dashes',
  frameWidth: 8,
  frameRadius: 2,
  frameCount: 28,
  badgeRadius: 21,
}, 'png')

const svg = await generateDySvg({ data: 'https://v.douyin.com/utbKgTJRmlI/' })
```

### `scan(imageData)`

异步扫描图片中的 QR 码。

| 参数 | 类型 | 说明 |
|------|------|------|
| `imageData` | `Uint8Array` | 图片文件的二进制数据（PNG/JPEG/WebP） |

返回值：`Promise<string | null>`，解码成功返回 QR 码文本内容，未识别到返回 `null`。

除标准二维码外，`scan` 也会自动识别抖音码
（`BEF_CODE_TYPE_DY_CODE`）。这类码没有标准 QR 的定位图案，常规解码失败后
会改走四条数据环的极坐标采样、解扰与 Reed-Solomon 纠错路径，调用方式不变。

### `scanDetailed(imageData)`

异步扫描并返回文本与位置信息，返回 `Promise<ScanDetails | null>`：

```ts
interface ScanDetails {
  text: string
  width: number
  height: number
  /** 定位点：标准二维码为定位图案中心；抖音码为圆心或三个圆形标记中心 */
  points: ScanPoint[]
  /** 抖音码的圆心与半径；标准二维码为 null */
  circle: ScanCircle | null
}
```

坐标均为原图像素坐标。同步版本为 `scanDetailedSync(imageData)`，
`@ikenxuan/qrcode/browser` 入口也导出同名方法。

### 同步 API

需要同步调用时使用：

- `generateSync(options, format, encoding?)`
- `generateSvgSync(options)`
- `generateDySync(options, format?, encoding?)`
- `generateDySvgSync(options)`
- `scanSync(imageData)`
- `scanDetailedSync(imageData)`

### 浏览器入口

浏览器、React Client Component、Vue SFC 等客户端环境使用：

```ts
import { generate, generateSvg, generateDy, generateDySvg, scan } from '@ikenxuan/qrcode/browser'

const png = await generate({ data: location.href }, 'png')
const svg = await generateSvg({ data: location.href })
const dyPng = await generateDy({ data: 'https://v.douyin.com/utbKgTJRmlI/' }, 'png')
const dySvg = await generateDySvg({ data: 'https://v.douyin.com/utbKgTJRmlI/' })
const text = await scan(png)
```

---

## QRCodeOptions

```ts
interface QRCodeOptions {
  data: string                // 编码内容
  size?: number               // 尺寸（像素），默认 300
  margin?: number             // 外边距（像素）
  shape?: ShapeType           // 整体形状
  dotsOptions?: DotsOptions   // 点阵样式
  cornersSquareOptions?: CornersSquareOptions
  cornersDotOptions?: CornersDotOptions
  backgroundOptions?: BackgroundOptions
  image?: Uint8Array          // Logo 图片数据
  imageOptions?: ImageOptions // Logo 尺寸、留白、圆角与点阵挖空配置
}
```

---

## DyCodeOptions

```ts
interface DyCodeOptions {
  data: string                // 编码内容，UTF-8 最多 38 字节
  size?: number               // 输出边长（像素），提供后反推 scale
  scale?: number              // 每个设计单位的像素数，默认 1.833
  margin?: number             // 图片边距，默认 16
  darkColor?: string          // 前景色，默认 #161823
  lightColor?: string         // 背景色，默认 #ffffff
  transparent?: boolean       // 透明背景，默认 false
  moduleStyle?: DyModuleStyle // 'rounded' | 'square' | 'pill'
  moduleRadius?: number       // rounded 圆角半径，默认 1.2
  frame?: boolean             // 外圈装饰，默认 true
  frameStyle?: DyFrameStyle   // 'arcs' | 'ring' | 'dashes' | 'dots' | 'ticks' | 'double' | 'segments' | 'spark' | 'orbit' | 'gear'
  frameWidth?: number         // 外圈径向宽度，默认 9，范围 1..16
  frameRadius?: number        // 外圈端点圆角，默认 0
  frameSpan?: number          // arcs 单段角度，默认 64，范围 4..120
  frameCount?: number         // dashes/dots/ticks 数量，默认 24，范围 4..120
  logo?: boolean              // 中心播放图标，默认 true
  centerImage?: Uint8Array    // 覆盖中心圆盘的图片，提供后替代播放图标
  badge?: boolean             // 右上角图片槽位，默认 true
  badgeRadius?: number        // 右上角图片半径，默认 21
  badgeImage?: Uint8Array     // 右上角圆形图片
  formatCode?: number         // 格式码 1..6，默认 5
  param?: number              // 参数 0..63，默认 20（掩码 4）
  fieldXor?: boolean          // 参数字段异或形式，默认 true
}
```

---

## 可选值

| 类型 | 可选值 |
|------|--------|
| OutputFormat | `'svg'`, `'png'`, `'jpeg'`, `'webp'` |
| DotType | `'square'`, `'dots'`, `'rounded'`, `'classy'`, `'classy-rounded'`, `'extra-rounded'` |
| CornerSquareType | `'square'`, `'dot'`, `'extra-rounded'` |
| CornerDotType | `'square'`, `'dot'` |
| ShapeType | `'square'`, `'circle'` |
| DyModuleStyle | `'rounded'`, `'square'`, `'pill'` |
| DyFrameStyle | `'arcs'`, `'ring'`, `'dashes'`, `'dots'`, `'ticks'`, `'double'`, `'segments'`, `'spark'`, `'orbit'`, `'gear'` |

也可以使用常量对象：`DotType.Rounded`、`OutputFormat.Png` 等。

### ImageOptions

```ts
interface ImageOptions {
  imageSize?: number          // Logo 占二维码的比例，默认 0.4，建议不超过 0.25
  margin?: number             // Logo 周围留白像素，默认 0
  round?: number              // Logo 圆角比例 0.0 ~ 0.5，默认 0
  hideBackgroundDots?: boolean // 是否挖空 Logo 下方点阵，默认 true
}
```

### BackgroundOptions

```ts
interface BackgroundOptions {
  color?: string        // 背景色，十六进制
  transparent?: boolean // 透明背景
  gradient?: Gradient   // 渐变背景
  round?: number        // 圆角比例 0.0 ~ 0.5
}
```

---

## 示例

```ts
import { generate, scan } from '@ikenxuan/qrcode'

// 圆形二维码 + 渐变色 + 透明背景
const png = await generate({
  data: 'https://github.com/ikenxuan',
  size: 400,
  shape: 'circle',
  dotsOptions: {
    dotType: 'dots',
    gradient: { colorFrom: '#667eea', colorTo: '#764ba2' },
  },
  backgroundOptions: { transparent: true },
}, 'png')

// base64 输出，可直接用于 <img src>
const b64 = await generate({
  data: 'https://example.com',
  dotsOptions: { dotType: 'rounded', color: '#1a1a2e' },
}, 'png', 'base64')

// 扫描 QR 码
import { readFileSync } from 'fs'
const img = readFileSync('qrcode.png')
const content = await scan(img) // 'https://example.com'
```

## 性能

二维码生成的耗时几乎全在 WASM 的光栅化与图片编码上，随**像素数**增长：1000×1000 的
输出约是 300×300 的 10 倍量级，Logo 越大越明显。需要调优时先跑基准：

```bash
pnpm --filter @ikenxuan/qrcode bench        # 二维码生成场景
pnpm --filter @ikenxuan/qrcode bench:react  # React 渲染场景
```

基准只加载 `dist/` 构建产物，所以改完源码要先 `pnpm build:core`。场景设计与结果解读见
[benchmark/README.md](./benchmark/README.md)。

## License

MIT
