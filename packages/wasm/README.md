# @ikenxuan/qrcode-wasm

内部包，不对外发布。负责将 Rust QR 码生成与扫描逻辑编译为 WebAssembly。

## 技术栈

- [qr-code-styling](https://crates.io/crates/qr-code-styling) — QR 码生成与样式化
- [rxing](https://crates.io/crates/rxing) — QR 码扫描与解码（ZXing 的 Rust 移植）
- [wasm-bindgen](https://github.com/rustwasm/wasm-bindgen) — Rust ↔ JS 类型桥接
- [wasm-pack](https://rustwasm.github.io/wasm-pack/) — 构建工具链
- [resvg](https://github.com/nickel-org/resvg) — SVG 光栅化（透明背景渲染）

## 构建

```bash
pnpm build
# 等价于: wasm-pack build --target bundler --release --out-dir dist --out-name qrcode
```

## 产物

```
dist/
├── qrcode.js         JS 胶水代码
├── qrcode.d.ts       TypeScript 类型声明
└── qrcode_bg.wasm    WebAssembly 二进制
```

## 导出函数

| 函数 | 签名 | 说明 |
|------|------|------|
| `generate` | `(options: any, format: string) → Uint8Array` | 生成指定格式的二进制数据 |
| `generateSvg` | `(options: any) → string` | 生成 SVG 字符串 |
| `scan` | `(image_data: &[u8]) → Option<String>` | 扫描图片中的 QR 码 |
| `initSync` | `(module: BufferSource) → void` | 同步初始化 WASM |
| `default` (init) | `(url?: string \| URL) → Promise<void>` | 异步初始化 WASM |
