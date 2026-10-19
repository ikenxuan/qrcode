import { createMDX } from 'fumadocs-mdx/next';

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '');
const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  // GitHub Pages 只能托管静态文件，使用 Next.js 静态导出。
  output: 'export',
  // 生成 `foo/index.html` 而不是 `foo.html`，兼容 GitHub Pages 的目录索引。
  trailingSlash: true,
  // 项目站点部署在 https://<user>.github.io/<repo>/ 下时需要 basePath。
  // 自定义域名或用户站点可把 NEXT_PUBLIC_BASE_PATH 设为空字符串。
  basePath: basePath || undefined,
  images: {
    // 静态导出不支持 Next.js 图片优化服务。
    unoptimized: true,
  },
  reactStrictMode: true,
  serverExternalPackages: ['typescript', 'twoslash'],
};

export default withMDX(config);
