# @ikenxuan/qrcode

基于 Rust [qr-code-styling](https://crates.io/crates/qr-code-styling) + [rxing](https://crates.io/crates/rxing) 的高性能 QR 码生成与扫描工具，通过 WebAssembly 提供跨平台支持。

## 特性

### 生成

- 多种点阵样式（square、dots、rounded、classy、classy-rounded、extra-rounded）
- 定位角方块和内部点自定义样式
- 渐变色支持
- 透明背景 / 自定义背景色
- 圆形二维码
- Logo 图片嵌入
- 输出格式：png、jpeg、webp、svg
- 输出编码：二进制（Uint8Array）或 base64 字符串

### 扫描

- 支持 PNG、JPEG、WebP 格式图片
- 多区域分块扫描，适用于大图中的小尺寸二维码
- 多种图像预处理策略（二值化、锐化、对比度增强、反色等）
- 透明背景图片自动合成白底处理

### 通用

- WASM 内联，无需外部 .wasm 文件，下游打包零配置
- Node.js 和浏览器通用，import 即用，无需初始化

## 使用

```ts
import { generate, generateSvg, scan } from '@ikenxuan/qrcode'

// 生成
const png = generate({ data: 'https://example.com' }, 'png')
const b64 = generate({ data: 'https://example.com' }, 'png', 'base64')
const svg = generateSvg({ data: 'https://example.com' })

// 扫描
const result = scan(png) // 'https://example.com'
```

完整文档请查看 [packages/core/README.md](./packages/core/README.md)。

## 项目结构

```
packages/
├── wasm/   Rust → WebAssembly 编译（wasm-pack + wasm-bindgen）
└── core/   TypeScript 封装层，发布为 @ikenxuan/qrcode
```

## 开发

```bash
# 安装依赖
pnpm install

# 构建 wasm
pnpm build:wasm

# 构建 core（含测试）
pnpm build:core
```

## License

MIT
