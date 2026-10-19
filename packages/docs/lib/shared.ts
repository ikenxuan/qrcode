export const appName = '@ikenxuan/qrcode';
export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

/**
 * GitHub Pages 项目站点的部署子路径（例如 `/qrcode`）。
 *
 * 自定义域名或用户站点部署时设为空字符串。构建期通过
 * `NEXT_PUBLIC_BASE_PATH` 注入，必须与 `next.config.mjs` 中的 `basePath` 一致。
 */
export const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '');

/** 文档站点的绝对地址，用于生成绝对链接。 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://ikenxuan.github.io/qrcode';

/**
 * `metadataBase` 只取站点 origin。
 *
 * OG 图片等站内资源路径已经通过 {@link withBasePath} 带上了部署子路径，
 * 若 `metadataBase` 再包含子路径会被重复拼接。
 */
export const metadataBaseUrl = new URL(siteUrl).origin;

/** 给站内绝对路径加上部署子路径。 */
export const withBasePath = (path: string): string => {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${basePath}${normalized}` || '/';
};

// fill this with your actual GitHub info, for example:
export const gitConfig = {
  user: 'ikenxuan',
  repo: 'qrcode',
  branch: 'main',
};
