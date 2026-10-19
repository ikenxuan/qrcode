# docs

`@ikenxuan/qrcode` 的文档站，基于 Next.js + Fumadocs，静态导出后部署到 GitHub Pages。

## 本地开发

文档站通过 workspace 直接引用本仓库的 `@ikenxuan/qrcode`，因此首次启动前需要先构建 wasm 与 core：

```bash
# 在仓库根目录执行
pnpm install
pnpm build:wasm
pnpm build:core

# 启动文档开发服务器
pnpm --filter docs dev
```

之后修改 `packages/core` 或 `packages/wasm` 的代码时，需要重新执行 `pnpm build:core`
（或根目录的 `pnpm build`），文档站的 playground 才会使用最新构建。

## 静态构建

```bash
pnpm --filter docs build
```

产物位于 `packages/docs/out/`。本地预览：

```bash
pnpm --filter docs preview
```

## GitHub Pages 部署

`.github/workflows/docs.yml` 会在以下情况自动构建并部署：

- `main` 分支上 `packages/docs`、`packages/core`、`packages/wasm` 或锁文件发生变化；
- 手动触发 `Docs` workflow。

仓库需要在 **Settings → Pages → Build and deployment** 中把 Source 设为
**GitHub Actions**。

项目站点的部署子路径由 `actions/configure-pages` 自动注入：

- `NEXT_PUBLIC_BASE_PATH`：例如 `/qrcode`，对应 `next.config.mjs` 的 `basePath`；
- `NEXT_PUBLIC_SITE_URL`：例如 `https://ikenxuan.github.io/qrcode`，用于 `metadataBase`。

自定义域名或用户站点（`<user>.github.io`）时，`base_path` 为空，无需额外配置。
本地构建若要模拟项目站点，可显式设置：

```bash
NEXT_PUBLIC_BASE_PATH=/qrcode \
NEXT_PUBLIC_SITE_URL=https://ikenxuan.github.io/qrcode \
pnpm --filter docs build
```

## 路由说明

静态导出不支持 middleware，因此已移除 `proxy.ts` 的 Markdown 内容协商。
文档仍可通过 `/llms.mdx/docs/<slug>/content.md` 获取 Markdown 源文，
搜索使用构建期导出的静态索引 `/api/search`。
