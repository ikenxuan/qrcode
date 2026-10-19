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
}

export interface LogoState {
  bytes: Uint8Array | null;
  name: string;
  previewUrl: string;
}

/** 预设只覆盖外观相关字段，保留用户输入的内容和输出格式。 */
export type PresetStyle = Omit<PlaygroundState, 'content' | 'format' | 'encoding'>;

export interface PresetOption {
  value: PresetKey;
  label: string;
  description: string;
  style: PresetStyle;
}

export interface CodeSample {
  key: CodeSampleKey;
  label: string;
  description: string;
  code: string;
  language: string;
}
