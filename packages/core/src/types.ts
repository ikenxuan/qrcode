/** QR 码点阵样式类型 */
export const DotType = {
  /** 方形点阵 */
  Square: 'square',
  /** 圆形点阵 */
  Dots: 'dots',
  /** 圆角方形点阵 */
  Rounded: 'rounded',
  /** 经典样式点阵 */
  Classy: 'classy',
  /** 经典圆角样式点阵 */
  ClassyRounded: 'classy-rounded',
  /** 超圆角样式点阵 */
  ExtraRounded: 'extra-rounded',
} as const
export type DotType = (typeof DotType)[keyof typeof DotType]

/** QR 码定位角方块样式类型 */
export const CornerSquareType = {
  /** 方形 */
  Square: 'square',
  /** 圆形 */
  Dot: 'dot',
  /** 超圆角 */
  ExtraRounded: 'extra-rounded',
} as const
export type CornerSquareType = (typeof CornerSquareType)[keyof typeof CornerSquareType]

/** QR 码定位角内部点样式类型 */
export const CornerDotType = {
  /** 方形 */
  Square: 'square',
  /** 圆形 */
  Dot: 'dot',
} as const
export type CornerDotType = (typeof CornerDotType)[keyof typeof CornerDotType]

/** QR 码整体形状类型 */
export const ShapeType = {
  /** 方形（默认） */
  Square: 'square',
  /** 圆形 */
  Circle: 'circle',
} as const
export type ShapeType = (typeof ShapeType)[keyof typeof ShapeType]

/** 输出格式 */
export const OutputFormat = {
  /** SVG 矢量图 */
  Svg: 'svg',
  /** PNG 位图 */
  Png: 'png',
  /** JPEG 位图 */
  Jpeg: 'jpeg',
  /** WebP 位图 */
  WebP: 'webp',
} as const
export type OutputFormat = (typeof OutputFormat)[keyof typeof OutputFormat]

/** 输出编码方式 */
export type Encoding = 'binary' | 'base64'

/** 根据编码方式推导返回类型 */
export type GenerateResult<E extends Encoding> = E extends 'base64' ? string : Uint8Array<ArrayBuffer>

/**
 * CSS 颜色字符串
 *
 * 支持以下格式：
 * - hex: `#RGB`, `#RRGGBB`, `#RRGGBBAA`
 * - rgb/rgba: `rgb(r, g, b)`, `rgba(r, g, b, a)`, `rgb(r g b / a)`
 * - hsl/hsla: `hsl(h, s%, l%)`, `hsla(h, s%, l%, a)`, `hsl(h s% l% / a)`
 * - oklab: `oklab(L a b)`, `oklab(L a b / alpha)`
 * - oklch: `oklch(L C H)`, `oklch(L C H / alpha)`
 * - 命名颜色: `transparent`, `black`, `white`, `red`, `green`, `blue`,
 *   `yellow`, `cyan`, `magenta`, `orange`, `purple`, `gray`
 *
 * alpha 值支持小数 (0~1) 或百分比 (0%~\100%)
 */
export type CSSColor = string

/** 渐变色配置 */
export interface Gradient {
  /** 渐变起始颜色 (支持所有 {@link CSSColor} 格式) */
  colorFrom: CSSColor
  /** 渐变结束颜色 (支持所有 {@link CSSColor} 格式) */
  colorTo: CSSColor
}

/** 点阵样式配置 */
export interface DotsOptions {
  /** 点阵形状类型 */
  dotType: DotType
  /** 点阵颜色 (支持所有 {@link CSSColor} 格式)，与 gradient 互斥 */
  color?: CSSColor
  /** 点阵渐变色配置，与 color 互斥 */
  gradient?: Gradient
}

/** 定位角方块样式配置 */
export interface CornersSquareOptions {
  /** 定位角方块形状类型 */
  cornerType: CornerSquareType
  /** 颜色 (支持所有 {@link CSSColor} 格式) */
  color?: CSSColor
  /** 渐变色配置 */
  gradient?: Gradient
}

/** 定位角内部点样式配置 */
export interface CornersDotOptions {
  /** 定位角内部点形状类型 */
  cornerType: CornerDotType
  /** 颜色 (支持所有 {@link CSSColor} 格式) */
  color?: CSSColor
  /** 渐变色配置 */
  gradient?: Gradient
}

/** Logo 图片嵌入配置 */
export interface ImageOptions {
  /**
   * Logo 占 QR 码的比例，范围 `0.0` ~ `1.0`，默认 `0.4`。
   *
   * 建议 `≤ 0.25`，过大会覆盖过多点阵导致无法扫描。
   */
  imageSize?: number
  /** Logo 周围的留白像素，默认 `0` */
  margin?: number
  /**
   * Logo 圆角比例，范围 `0.0` ~ `0.5`，默认 `0`。
   *
   * `0` 保留原始直角，`0.5` 可将正方形 Logo 裁剪为圆形。
   * 该选项只裁剪 Logo 图片，不改变 {@link hideBackgroundDots} 的矩形挖空区域。
   */
  round?: number
  /**
   * 是否挖空 Logo 区域下方的点阵，默认 `true`。
   *
   * 开启后 Logo 不会与点阵图案叠加，视觉更干净。
   */
  hideBackgroundDots?: boolean
}

/** 背景配置 */
export interface BackgroundOptions {
  /** 背景颜色 (支持所有 {@link CSSColor} 格式)。设置 transparent 时忽略 */
  color?: CSSColor
  /** 是否透明背景 */
  transparent?: boolean
  /** 背景渐变色配置 */
  gradient?: Gradient
  /** 背景圆角比例，范围 0.0 ~ 0.5 */
  round?: number
}

/** QR 码生成配置项 */
export interface QRCodeOptions {
  /** 要编码的数据内容（URL、文本等） */
  data: string
  /** QR 码尺寸（像素），默认 300 */
  size?: number
  /** QR 码外边距（像素） */
  margin?: number
  /** QR 码整体形状 */
  shape?: ShapeType
  /** 点阵样式配置 */
  dotsOptions?: DotsOptions
  /** 定位角方块样式配置 */
  cornersSquareOptions?: CornersSquareOptions
  /** 定位角内部点样式配置 */
  cornersDotOptions?: CornersDotOptions
  /** 背景配置（默认白色，可设置透明） */
  backgroundOptions?: BackgroundOptions
  /**
   * 嵌入到二维码中心的 Logo 图片**二进制数据**（非 URL / 路径）。
   *
   * 支持 PNG / JPEG / WebP。Node 端可用 `readFileSync('logo.png')` 读取，
   * 浏览器端可用 `new Uint8Array(await blob.arrayBuffer())`。
   */
  image?: Uint8Array
  /** Logo 图片嵌入配置，需与 {@link image} 配合使用 */
  imageOptions?: ImageOptions
}
