# @ikenxuan/qrcode

基于 Rust [qr-code-styling](https://crates.io/crates/qr-code-styling) 的高性能 QR 码生成器。通过 WebAssembly 实现跨平台运行，Node.js 和浏览器通用。

## 安装

```bash
pnpm add @ikenxuan/qrcode
```

## 快速开始

```ts
import { generate, generateSvg } from '@ikenxuan/qrcode'

// 生成 PNG 二进制
const png = generate({ data: 'https://example.com' }, 'png')

// 生成 base64 字符串
const b64 = generate({ data: 'https://example.com' }, 'png', 'base64')

// 生成 SVG 字符串
const svg = generateSvg({ data: 'https://example.com' })
```

WASM 已内联，import 即用，无需初始化，无需关心 `.wasm` 文件路径。

---

## API

### `generate(options, format, encoding?)`

生成 QR 码。

| 参数 | 类型 | 说明 |
|------|------|------|
| `options` | `QRCodeOptions` | QR 码配置 |
| `format` | `OutputFormat` | 输出格式 |
| `encoding` | `'binary' \| 'base64'` | 编码方式，默认 `'binary'` |

返回值根据 `encoding` 自动推导类型：
- `'binary'`（默认）→ `Uint8Array`
- `'base64'` → `string`

### `generateSvg(options)`

生成 SVG 字符串，返回 `string`。

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
  imageOptions?: ImageOptions
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

也可以使用常量对象：`DotType.Rounded`、`OutputFormat.Png` 等。

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
import { generate } from '@ikenxuan/qrcode'

// 圆形二维码 + 渐变色 + 透明背景
const png = generate({
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
const b64 = generate({
  data: 'https://example.com',
  dotsOptions: { dotType: 'rounded', color: '#1a1a2e' },
}, 'png', 'base64')
```
## TODO

[ ] 二维码解码

## License

MIT
