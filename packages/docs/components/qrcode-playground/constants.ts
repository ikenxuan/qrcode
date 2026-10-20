import type {
  CodeSampleKey,
  CodeType,
  CornerDotType,
  CornerSquareType,
  DotType,
  DyFrameStyle,
  DyModuleStyle,
  DyPresetKey,
  DyPresetOption,
  DyPresetStyle,
  Encoding,
  OutputFormat,
  PlaygroundState,
  PresetKey,
  PresetOption,
  PresetStyle,
  SelectOption,
  ShapeType,
} from './types';

export const fallbackContent = 'https://github.com/ikenxuan/qrcode';

/** 切换到抖音码时使用的默认内容。 */
export const dyFallbackContent = 'https://bing.com';

/** 预设与默认状态共用的外观基线。 */
const presetDefaults: PresetStyle = {
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

/** 标准二维码的默认外观；「恢复默认」会套用这份配置。 */
export const qrDefaults: PresetStyle = presetDefaults;

/** 抖音码的官方默认外观。 */
export const dyDefaults = {
  dySize: 432,
  dyMargin: 16,
  dyDarkColor: '#161823',
  dyLightColor: '#ffffff',
  dyTransparent: false,
  dyModuleStyle: 'rounded' as DyModuleStyle,
  dyModuleRadius: 1.2,
  dyFrame: true,
  dyFrameStyle: 'arcs' as DyFrameStyle,
  dyFrameWidth: 9,
  dyFrameRadius: 0,
  dyFrameSpan: 64,
  dyFrameCount: 24,
  dyLogo: true,
  dyBadge: true,
  dyBadgeRadius: 21,
};

const createDyPreset = (
  value: DyPresetKey,
  label: string,
  description: string,
  overrides: Partial<DyPresetStyle>,
): DyPresetOption => ({
  value,
  label,
  description,
  style: {
    dySize: dyDefaults.dySize,
    dyMargin: dyDefaults.dyMargin,
    dyDarkColor: dyDefaults.dyDarkColor,
    dyLightColor: dyDefaults.dyLightColor,
    dyTransparent: dyDefaults.dyTransparent,
    dyModuleStyle: dyDefaults.dyModuleStyle,
    dyModuleRadius: dyDefaults.dyModuleRadius,
    dyFrame: dyDefaults.dyFrame,
    dyFrameStyle: dyDefaults.dyFrameStyle,
    dyFrameWidth: dyDefaults.dyFrameWidth,
    dyFrameRadius: dyDefaults.dyFrameRadius,
    dyFrameSpan: dyDefaults.dyFrameSpan,
    dyFrameCount: dyDefaults.dyFrameCount,
    dyLogo: dyDefaults.dyLogo,
    dyBadgeRadius: dyDefaults.dyBadgeRadius,
    ...overrides,
  },
});

/** 抖音码预设，全部保持深色模块 + 浅色背景，确保可扫描。 */
export const dyPresetOptions: DyPresetOption[] = [
  createDyPreset('official', '官方默认', '深墨前景、纯白背景，保留外圈装饰弧与中心播放图标。', {}),
  createDyPreset('mono', '极简黑白', '纯黑方形模块，去掉装饰弧和播放图标，边界最清晰。', {
    dySize: 400,
    dyDarkColor: '#111827',
    dyModuleStyle: 'square',
    dyModuleRadius: 0,
    dyFrame: false,
    dyLogo: false,
  }),
  createDyPreset('transparent', '透明极简', '透明背景配深灰方形模块，可直接叠在任意底图上。', {
    dySize: 400,
    dyMargin: 0,
    dyDarkColor: '#111827',
    dyTransparent: true,
    dyModuleStyle: 'square',
    dyModuleRadius: 0,
    dyFrame: false,
    dyLogo: false,
  }),
  createDyPreset('ink', '水墨留白', '近黑前景配冷白背景，圆角模块与完整圆环外圈更克制。', {
    dyMargin: 20,
    dyDarkColor: '#1f2937',
    dyLightColor: '#f8fafc',
    dyFrameStyle: 'ring',
    dyFrameWidth: 6,
  }),
  createDyPreset('ocean', '海盐蓝', '深蓝前景配浅蓝背景，断续弧段外圈，适合商务与产品页面。', {
    dyDarkColor: '#1e3a8a',
    dyLightColor: '#eff6ff',
    dyFrameStyle: 'dashes',
    dyFrameRadius: 2,
    dyFrameCount: 28,
  }),
  createDyPreset('forest', '森林绿', '墨绿前景配薄荷背景，双层圆环外圈，清爽且对比充足。', {
    dyDarkColor: '#14532d',
    dyLightColor: '#ecfdf5',
    dyFrameStyle: 'double',
    dyFrameWidth: 10,
  }),
  createDyPreset('sakura', '樱花粉', '深玫红前景配浅粉背景，圆点串外圈，柔和但仍有足够对比。', {
    dyDarkColor: '#831843',
    dyLightColor: '#fdf2f8',
    dyModuleStyle: 'pill',
    dyFrameStyle: 'dots',
    dyFrameCount: 32,
  }),
  createDyPreset('sunset', '落日橙', '深棕橙前景配暖白背景，刻度外圈，适合活动与短视频场景。', {
    dyDarkColor: '#7c2d12',
    dyLightColor: '#fff7ed',
    dyModuleStyle: 'pill',
    dyFrameStyle: 'ticks',
    dyFrameCount: 36,
  }),
  createDyPreset('grape', '葡萄紫', '深紫前景配淡紫背景，细圆环外圈，适合创意与设计类项目。', {
    dyDarkColor: '#4c1d95',
    dyLightColor: '#f5f3ff',
    dyFrameStyle: 'ring',
    dyFrameWidth: 7,
  }),
  createDyPreset('high-contrast', '高对比黑白', '纯黑方形模块、纯白背景、更大留白，优先远距离识别。', {
    dySize: 480,
    dyMargin: 24,
    dyDarkColor: '#000000',
    dyLightColor: '#ffffff',
    dyModuleStyle: 'square',
    dyModuleRadius: 0,
    dyFrame: false,
    dyLogo: false,
  }),
];

export const defaultPlaygroundState: PlaygroundState = {
  codeType: 'qrcode',
  content: fallbackContent,
  format: 'png',
  encoding: 'binary',
  ...presetDefaults,
  ...dyDefaults,
};

const createPreset = (
  value: PresetKey,
  label: string,
  description: string,
  overrides: Partial<PresetStyle>,
): PresetOption => ({
  value,
  label,
  description,
  style: { ...presetDefaults, ...overrides },
});

/** 20 套完整视觉方案，只覆盖外观字段。 */
export const presetOptions: PresetOption[] = [
  createPreset('rust', 'Rust 暖橙', '默认主题：暖橙渐变点阵配深棕定位角，适合项目文档与首页。', {}),
  createPreset('mono', '极简黑白', '纯黑点阵、纯白背景与方形定位角，打印和弱光环境最稳。', {
    dotType: 'square',
    margin: 16,
    dotColor: '#111827',
    useDotGradient: false,
    cornerSquareType: 'square',
    cornerSquareColor: '#111827',
    cornerDotType: 'square',
    cornerDotColor: '#111827',
    backgroundColor: '#ffffff',
    backgroundRound: 0,
  }),
  createPreset('neon-night', '午夜霓虹', '青色到紫色的霓虹渐变，搭配深蓝渐变背景，适合科技感海报。', {
    dotType: 'extra-rounded',
    dotColor: '#22d3ee',
    dotGradientTo: '#a855f7',
    cornerSquareColor: '#22d3ee',
    cornerSquareGradientTo: '#a855f7',
    useCornerSquareGradient: true,
    cornerDotColor: '#a855f7',
    backgroundColor: '#0b1020',
    backgroundGradientTo: '#1e1b4b',
    useBackgroundGradient: true,
    backgroundRound: 0.16,
  }),
  createPreset('mint-forest', '森林薄荷', '墨绿到薄荷绿的渐变圆点，配浅薄荷背景，清爽且对比清晰。', {
    dotType: 'dots',
    dotColor: '#0f766e',
    dotGradientTo: '#34d399',
    cornerSquareType: 'dot',
    cornerSquareColor: '#0f766e',
    cornerDotColor: '#064e3b',
    backgroundColor: '#ecfdf5',
    backgroundRound: 0.12,
  }),
  createPreset('ocean', '海盐蓝', '深蓝到天蓝的渐变，浅蓝背景收边，适合商务与产品页面。', {
    dotColor: '#1d4ed8',
    dotGradientTo: '#38bdf8',
    cornerSquareColor: '#1e3a8a',
    cornerDotColor: '#0ea5e9',
    backgroundColor: '#eff6ff',
    backgroundRound: 0.1,
  }),
  createPreset('sakura', '樱花粉', '粉色渐变圆点与柔和粉底，适合活动、社群与女性向视觉。', {
    dotType: 'dots',
    dotColor: '#db2777',
    dotGradientTo: '#f9a8d4',
    cornerSquareType: 'dot',
    cornerSquareColor: '#9d174d',
    cornerDotColor: '#ec4899',
    backgroundColor: '#fdf2f8',
    backgroundRound: 0.14,
  }),
  createPreset('sunset', '日落橙红', '橙红渐变点阵叠暖色渐变背景，适合促销与短视频场景。', {
    dotType: 'classy-rounded',
    dotColor: '#f97316',
    dotGradientTo: '#dc2626',
    cornerSquareColor: '#7c2d12',
    cornerDotType: 'square',
    cornerDotColor: '#ea580c',
    backgroundColor: '#fff7ed',
    backgroundGradientTo: '#fed7aa',
    useBackgroundGradient: true,
  }),
  createPreset('grape', '葡萄紫', '紫色渐变点阵配淡紫背景，适合创意与设计类项目。', {
    dotType: 'extra-rounded',
    dotColor: '#7c3aed',
    dotGradientTo: '#c084fc',
    cornerSquareColor: '#4c1d95',
    cornerDotColor: '#a855f7',
    backgroundColor: '#f5f3ff',
    backgroundRound: 0.12,
  }),
  createPreset('latte', '拿铁咖啡', '棕色渐变与米色背景，气质温和，适合餐饮和生活方式品牌。', {
    dotColor: '#78350f',
    dotGradientTo: '#d6a06a',
    cornerSquareColor: '#451a03',
    cornerDotColor: '#92400e',
    backgroundColor: '#fdf6ec',
    backgroundRound: 0.1,
  }),
  createPreset('graphite', '石墨灰', '深灰方形点阵与浅灰背景，低饱和、偏工具感的稳妥方案。', {
    dotType: 'square',
    margin: 16,
    dotColor: '#374151',
    useDotGradient: false,
    cornerSquareType: 'square',
    cornerSquareColor: '#111827',
    cornerDotType: 'square',
    cornerDotColor: '#374151',
    backgroundColor: '#f3f4f6',
    backgroundRound: 0.04,
  }),
  createPreset('transparent-minimal', '透明极简', '透明背景配纯黑方形点阵，可直接叠在任意底图上。', {
    dotType: 'square',
    margin: 8,
    dotColor: '#111827',
    useDotGradient: false,
    cornerSquareType: 'square',
    cornerSquareColor: '#111827',
    cornerDotType: 'square',
    cornerDotColor: '#111827',
    backgroundRound: 0,
    transparentBackground: true,
  }),
  createPreset('circle-badge', '圆形徽章', '圆形外轮廓配蓝紫渐变，适合头像、贴纸和圆形入口。', {
    shape: 'circle',
    dotType: 'extra-rounded',
    margin: 8,
    dotColor: '#0ea5e9',
    dotGradientTo: '#6366f1',
    cornerSquareType: 'dot',
    cornerSquareColor: '#1e3a8a',
    cornerDotColor: '#6366f1',
    backgroundColor: '#eef2ff',
    backgroundRound: 0.5,
  }),
  createPreset('midnight-gold', '暗夜鎏金', '黑金渐变圆点配深色渐变背景，适合高端活动与会员卡片。', {
    dotType: 'dots',
    dotColor: '#f59e0b',
    dotGradientTo: '#fde68a',
    cornerSquareColor: '#b45309',
    cornerDotColor: '#fbbf24',
    backgroundColor: '#111827',
    backgroundGradientTo: '#1f2937',
    useBackgroundGradient: true,
    backgroundRound: 0.14,
  }),
  createPreset('electric-cyan', '电光青', '青色渐变方形点阵配近黑背景，对比强烈、识别稳定。', {
    dotType: 'square',
    dotColor: '#06b6d4',
    dotGradientTo: '#22d3ee',
    cornerSquareType: 'square',
    cornerSquareColor: '#0e7490',
    cornerDotType: 'square',
    cornerDotColor: '#0891b2',
    backgroundColor: '#020617',
    backgroundRound: 0.06,
  }),
  createPreset('vintage-paper', '复古报纸', '深棕切角点阵配做旧纸张渐变，适合杂志与怀旧主题。', {
    dotType: 'classy',
    margin: 18,
    dotColor: '#4b2e1e',
    useDotGradient: false,
    cornerSquareType: 'square',
    cornerSquareColor: '#3f2418',
    cornerDotType: 'square',
    cornerDotColor: '#4b2e1e',
    backgroundColor: '#f5ecd7',
    backgroundGradientTo: '#e7d8b8',
    useBackgroundGradient: true,
    backgroundRound: 0.02,
  }),
  createPreset('candy', '糖果渐变', '粉到黄的糖果渐变圆点，配浅粉渐变背景，活泼吸睛。', {
    dotType: 'dots',
    dotColor: '#ec4899',
    dotGradientTo: '#fbbf24',
    cornerSquareType: 'dot',
    cornerSquareColor: '#db2777',
    cornerDotColor: '#f59e0b',
    backgroundColor: '#ffffff',
    backgroundGradientTo: '#fce7f3',
    useBackgroundGradient: true,
    backgroundRound: 0.16,
  }),
  createPreset('cyber-purple', '赛博紫', '品红到紫色的渐变配深紫背景，适合游戏与潮流主题。', {
    dotType: 'extra-rounded',
    dotColor: '#d946ef',
    dotGradientTo: '#8b5cf6',
    cornerSquareColor: '#86198f',
    cornerDotColor: '#c026d3',
    backgroundColor: '#1e1b4b',
    backgroundGradientTo: '#312e81',
    useBackgroundGradient: true,
    backgroundRound: 0.1,
  }),
  createPreset('forest-deep', '深林绿意', '深绿到亮绿的渐变，浅绿背景收边，自然且不刺眼。', {
    dotType: 'classy-rounded',
    dotColor: '#15803d',
    dotGradientTo: '#4ade80',
    cornerSquareColor: '#14532d',
    cornerDotColor: '#22c55e',
    backgroundColor: '#f0fdf4',
    backgroundRound: 0.08,
  }),
  createPreset('glacier', '冰川蓝', '浅蓝渐变与冰白背景，轻盈通透，适合医疗与清洁类视觉。', {
    dotColor: '#0ea5e9',
    dotGradientTo: '#bae6fd',
    cornerSquareColor: '#0369a1',
    cornerDotColor: '#38bdf8',
    backgroundColor: '#f0f9ff',
    backgroundGradientTo: '#e0f2fe',
    useBackgroundGradient: true,
    backgroundRound: 0.12,
  }),
  createPreset('high-contrast', '高对比黑白', '纯黑方形点阵、纯白背景和更大留白，优先保证远距离识别。', {
    dotType: 'square',
    size: 360,
    margin: 20,
    dotColor: '#000000',
    useDotGradient: false,
    cornerSquareType: 'square',
    cornerSquareColor: '#000000',
    cornerDotType: 'square',
    cornerDotColor: '#000000',
    backgroundColor: '#ffffff',
    backgroundRound: 0,
  }),
];

export const codeTypes: Array<SelectOption<CodeType>> = [
  {
    label: '标准二维码',
    value: 'qrcode',
    description: '方阵 QR 码，支持完整样式系统、SVG 与多种位图格式。',
  },
  {
    label: '抖音码',
    value: 'dy',
    description: '圆形抖音码，复刻官方默认版式，支持透明背景与多种输出格式，最多 38 字节文本。',
  },
];

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

export const dyModuleStyles: Array<SelectOption<DyModuleStyle>> = [
  { label: 'Rounded', value: 'rounded', description: '官方默认，环形扇区带 1.2 单位圆角。' },
  { label: 'Square', value: 'square', description: '直角环形扇区，边缘更硬朗。' },
  { label: 'Pill', value: 'pill', description: '最大圆角，接近胶囊形。' },
];

export const dyFrameStyles: Array<SelectOption<DyFrameStyle>> = [
  { label: '四段弧', value: 'arcs', description: '官方默认，四段圆弧留在 0° / 90° / 180° / 270°。' },
  { label: '完整圆环', value: 'ring', description: '一圈圆环，在定位环和右上角图片处自动断开。' },
  { label: '断续弧段', value: 'dashes', description: '均匀分布的短弧，自动避开定位环和右上角图片。' },
  { label: '圆点串', value: 'dots', description: '沿圆周排列的圆点，轻盈活泼。' },
  { label: '刻度线', value: 'ticks', description: '细密的径向刻度，像表盘一样强调方向感。' },
  { label: '双层圆环', value: 'double', description: '内外两条同心圆环，同样在定位点和图片处断开。' },
  { label: '分段圆环', value: 'segments', description: '较长弧段加细缝，接近断开的圆环。' },
  { label: '长短弧', value: 'spark', description: '长短弧交替排列，节奏感更强。' },
  { label: '双轨圆点', value: 'orbit', description: '内外两圈错位圆点，像行星轨道。' },
  { label: '齿轮环', value: 'gear', description: '细圆环配内侧轮齿，机械感最强。' },
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
