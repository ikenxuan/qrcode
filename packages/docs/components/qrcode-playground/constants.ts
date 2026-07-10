import type {
  CodeSampleKey,
  CornerDotType,
  CornerSquareType,
  DotType,
  Encoding,
  OutputFormat,
  PlaygroundState,
  SelectOption,
  ShapeType,
} from './types';

export const fallbackContent = 'https://github.com/ikenxuan/qrcode';

export const defaultPlaygroundState: PlaygroundState = {
  content: fallbackContent,
  format: 'png',
  encoding: 'binary',
  shape: 'square',
  dotType: 'rounded',
  size: 320,
  margin: 12,
  dotColor: '#b7410e',
  dotGradientTo: '#dea584',
  useDotGradient: true,
  cornerSquareType: 'extra-rounded',
  cornerSquareColor: '#5f2614',
  cornerSquareGradientTo: '#dea584',
  useCornerSquareGradient: false,
  cornerDotType: 'dot',
  cornerDotColor: '#5f2614',
  cornerDotGradientTo: '#dea584',
  useCornerDotGradient: false,
  backgroundColor: '#fff7ed',
  backgroundGradientTo: '#f6d2b0',
  useBackgroundGradient: false,
  backgroundRound: 0.08,
  transparentBackground: false,
  imageSize: 0.2,
  logoMargin: 6,
  logoRound: 0.16,
  hideBackgroundDots: true,
};

export const formats: Array<SelectOption<OutputFormat>> = [
  { label: 'PNG', value: 'png', description: '位图输出，适合网页和下载。Binary / base64 都可用。' },
  { label: 'WebP', value: 'webp', description: '更小的位图体积，适合现代浏览器。' },
  { label: 'JPEG', value: 'jpeg', description: '通用位图格式，不支持透明背景。' },
  { label: 'SVG', value: 'svg', description: '矢量字符串输出，忽略 encoding 参数。' },
];

export const encodings: Array<SelectOption<Encoding>> = [
  { label: 'Binary', value: 'binary', description: '返回 Uint8Array，适合写文件、Blob 和 scan。' },
  { label: 'Base64', value: 'base64', description: '返回 base64 字符串，适合 data URL 或网络传输。' },
];

export const shapeTypes: Array<SelectOption<ShapeType>> = [
  { label: 'Square', value: 'square', description: '方形外轮廓，兼容性最高。' },
  { label: 'Circle', value: 'circle', description: '圆形裁切外轮廓，适合头像或海报。' },
];

export const dotTypes: Array<SelectOption<DotType>> = [
  { label: 'Square', value: 'square', description: '方形点阵，边缘清晰，适合通用业务码。' },
  { label: 'Dots', value: 'dots', description: '圆点点阵，视觉更轻，适合品牌展示。' },
  { label: 'Rounded', value: 'rounded', description: '圆角方块，兼顾识别稳定和柔和观感。' },
  { label: 'Classy', value: 'classy', description: '经典切角样式，点阵更有装饰感。' },
  { label: 'Classy Rounded', value: 'classy-rounded', description: '经典圆角样式，适合精致卡片或海报。' },
  { label: 'Extra Rounded', value: 'extra-rounded', description: '超圆角点阵，风格最强，建议搭配高对比配色。' },
];

export const cornerSquareTypes: Array<SelectOption<CornerSquareType>> = [
  { label: 'Square', value: 'square', description: '方形定位角外框，识别稳定。' },
  { label: 'Dot', value: 'dot', description: '圆形定位角外框，整体更柔和。' },
  { label: 'Extra Rounded', value: 'extra-rounded', description: '大圆角定位角外框，适合 Rust 主题视觉。' },
];

export const cornerDotTypes: Array<SelectOption<CornerDotType>> = [
  { label: 'Square', value: 'square', description: '方形定位角中心点。' },
  { label: 'Dot', value: 'dot', description: '圆形定位角中心点。' },
];

export const colorPresets = [
  '#111827',
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#b7410e',
  '#dea584',
  '#5f2614',
  '#fff7ed',
  '#f6d2b0',
  '#0f766e',
  '#7c3aed',
  '#020617',
  '#f8fafc',
];

export const installCommands = [
  { label: 'pnpm', value: 'pnpm', command: 'pnpm add @ikenxuan/qrcode' },
  { label: 'npm', value: 'npm', command: 'npm install @ikenxuan/qrcode' },
  { label: 'yarn', value: 'yarn', command: 'yarn add @ikenxuan/qrcode' },
  { label: 'bun', value: 'bun', command: 'bun add @ikenxuan/qrcode' },
];

export const codeSampleKinds: Array<SelectOption<CodeSampleKey>> = [
  { label: 'Node', value: 'node', description: 'ESM + fs，适合服务端生成与落盘。' },
  { label: 'React', value: 'react', description: 'Client Component 中生成 Blob 或 data URL。' },
  { label: 'Vue 3', value: 'vue3', description: '<script setup lang="ts"> 中直接调用。' },
  { label: 'Browser', value: 'browser', description: '原生 ESM 浏览器脚本示例。' },
];

export const mimeTypes: Record<OutputFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

export const fileExtensions: Record<OutputFormat, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
  svg: 'svg',
};
