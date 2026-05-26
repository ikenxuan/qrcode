# @ikenxuan/qrcode

基于 Rust [qr-code-styling](https://crates.io/crates/qr-code-styling) 的高性能 QR 码生成器，通过 WebAssembly 提供跨平台支持。

## 特性

- 多种点阵样式（square、dots、rounded、classy、classy-rounded、extra-rounded）
- 定位角方块和内部点自定义样式
- 渐变色支持
- 透明背景 / 自定义背景色
- 圆形二维码
- Logo 图片嵌入
- 输出格式：png、jpeg、webp、svg
- 输出编码：二进制（Uint8Array）或 base64 字符串
- WASM 内联，无需外部 .wasm 文件，下游打包零配置
- Node.js 和浏览器通用，import 即用，无需初始化

## 使用

```ts
import { generate, generateSvg } from '@ikenxuan/qrcode'

const png = generate({ data: 'https://example.com' }, 'png')
const b64 = generate({ data: 'https://example.com' }, 'png', 'base64')
const svg = generateSvg({ data: 'https://example.com' })
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
