export type QRCodeModule = typeof import('@ikenxuan/qrcode/browser');
export type ScanDetails = import('@ikenxuan/qrcode/browser').ScanDetails;
export type ScanPoint = import('@ikenxuan/qrcode/browser').ScanPoint;
export type QRCodeOptions = import('@ikenxuan/qrcode/browser').QRCodeOptions;
export type OutputFormat = import('@ikenxuan/qrcode/browser').OutputFormat;
export type Encoding = import('@ikenxuan/qrcode/browser').Encoding;
export type DotType = import('@ikenxuan/qrcode/browser').DotType;
export type CornerSquareType = import('@ikenxuan/qrcode/browser').CornerSquareType;
export type CornerDotType = import('@ikenxuan/qrcode/browser').CornerDotType;
export type ShapeType = import('@ikenxuan/qrcode/browser').ShapeType;
export type DyModuleStyle = import('@ikenxuan/qrcode/browser').DyModuleStyle;
export type DyFrameStyle = import('@ikenxuan/qrcode/browser').DyFrameStyle;
export type DyCodeOptions = import('@ikenxuan/qrcode/browser').DyCodeOptions;

/** 工作台生成的码类型。 */
export type CodeType = 'qrcode' | 'dy';

export type CodeSampleKey = 'node' | 'react' | 'vue3' | 'browser';

export type PresetKey =
  | 'rust'
  | 'mono'
  | 'neon-night'
  | 'mint-forest'
  | 'ocean'
  | 'sakura'
  | 'sunset'
  | 'grape'
  | 'latte'
  | 'graphite'
  | 'transparent-minimal'
  | 'circle-badge'
  | 'midnight-gold'
  | 'electric-cyan'
  | 'vintage-paper'
  | 'candy'
  | 'cyber-purple'
  | 'forest-deep'
  | 'glacier'
  | 'high-contrast';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
}

export interface PlaygroundState {
  codeType: CodeType;
  content: string;
  format: OutputFormat;
  encoding: Encoding;
  shape: ShapeType;
  dotType: DotType;
  size: number;
  margin: number;
  dotColor: string;
  dotGradientTo: string;
  useDotGradient: boolean;
  cornerSquareType: CornerSquareType;
  cornerSquareColor: string;
  cornerSquareGradientTo: string;
  useCornerSquareGradient: boolean;
  cornerDotType: CornerDotType;
  cornerDotColor: string;
  cornerDotGradientTo: string;
  useCornerDotGradient: boolean;
  backgroundColor: string;
  backgroundGradientTo: string;
  useBackgroundGradient: boolean;
  backgroundRound: number;
  transparentBackground: boolean;
  imageSize: number;
  logoMargin: number;
  logoRound: number;
  hideBackgroundDots: boolean;
  /** 抖音码输出尺寸（像素）。 */
  dySize: number;
  /** 抖音码图片边距（像素）。 */
  dyMargin: number;
  /** 抖音码前景色。 */
  dyDarkColor: string;
  /** 抖音码背景色。 */
  dyLightColor: string;
  /** 抖音码是否使用透明背景。 */
  dyTransparent: boolean;
  /** 抖音码数据模块形状。 */
  dyModuleStyle: DyModuleStyle;
  /** 抖音码圆角模块的圆角半径。 */
  dyModuleRadius: number;
  /** 是否绘制抖音码外圈装饰。 */
  dyFrame: boolean;
  /** 抖音码外圈样式。 */
  dyFrameStyle: DyFrameStyle;
  /** 抖音码外圈径向宽度（设计单位）。 */
  dyFrameWidth: number;
  /** 抖音码外圈端点圆角（设计单位）。 */
  dyFrameRadius: number;
  /** 抖音码 arcs 样式的单段弧角度。 */
  dyFrameSpan: number;
  /** 抖音码分段式外圈的元素数量。 */
  dyFrameCount: number;
  /** 是否绘制抖音码中心播放图标。 */
  dyLogo: boolean;
  /** 是否绘制抖音码右上角图片槽位。 */
  dyBadge: boolean;
  /** 抖音码右上角图片半径。 */
  dyBadgeRadius: number;
}

export interface LogoState {
  bytes: Uint8Array | null;
  name: string;
  previewUrl: string;
}

/** 预设只覆盖标准二维码的外观字段，保留用户输入的内容、码类型和输出格式。 */
export type PresetStyle = Omit<
  PlaygroundState,
  | 'codeType'
  | 'content'
  | 'format'
  | 'encoding'
  | 'dySize'
  | 'dyMargin'
  | 'dyDarkColor'
  | 'dyLightColor'
  | 'dyTransparent'
  | 'dyModuleStyle'
  | 'dyModuleRadius'
  | 'dyFrame'
  | 'dyFrameStyle'
  | 'dyFrameWidth'
  | 'dyFrameRadius'
  | 'dyFrameSpan'
  | 'dyFrameCount'
  | 'dyLogo'
  | 'dyBadge'
  | 'dyBadgeRadius'
>;

export interface PresetOption {
  value: PresetKey;
  label: string;
  description: string;
  style: PresetStyle;
}

/** 抖音码预设标识。 */
export type DyPresetKey =
  | 'official'
  | 'mono'
  | 'transparent'
  | 'ink'
  | 'ocean'
  | 'forest'
  | 'sakura'
  | 'sunset'
  | 'grape'
  | 'high-contrast';

/** 抖音码预设只覆盖外观字段。 */
export interface DyPresetStyle {
  dySize: number;
  dyMargin: number;
  dyDarkColor: string;
  dyLightColor: string;
  dyTransparent: boolean;
  dyModuleStyle: DyModuleStyle;
  dyModuleRadius: number;
  dyFrame: boolean;
  dyFrameStyle: DyFrameStyle;
  dyFrameWidth: number;
  dyFrameRadius: number;
  dyFrameSpan: number;
  dyFrameCount: number;
  dyLogo: boolean;
  dyBadgeRadius: number;
}

export interface DyPresetOption extends SelectOption<DyPresetKey> {
  style: DyPresetStyle;
}

export interface CodeSample {
  key: CodeSampleKey;
  label: string;
  description: string;
  code: string;
  language: string;
}
