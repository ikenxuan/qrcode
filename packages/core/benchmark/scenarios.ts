/**
 * 场景定义。
 *
 * `downstream*` 系列逐字复刻 karin-plugin-kkk 的 `generateQRCode()` 参数，
 * 其余场景每次只改一个变量，用来把耗时归因到具体路径（透明光栅化 / Logo 处理 /
 * base64 编码 / 输出格式）。
 */
import type { Encoding, OutputFormat, QRCodeOptions } from '../dist/index.js'

export interface Scenario {
  name: string
  /** 人类可读的假设，说明这个场景在验证什么。 */
  probes: string
  options: QRCodeOptions
  format: OutputFormat
  encoding: Encoding
}

/** 下游小红书登录二维码的分享链接形态。 */
const DOWNSTREAM_DATA = 'https://www.xiaohongshu.com/user/profile/5f3b1c0e000000000100abcd?xsec_token=AB1cdEF2gh'

const downstreamBase = (): QRCodeOptions => ({
  data: DOWNSTREAM_DATA,
  size: 1000,
  dotsOptions: { dotType: 'extra-rounded', color: 'rgba(0, 0, 0, 0.8)' },
  cornersSquareOptions: { cornerType: 'dot', color: 'rgba(0, 0, 0, 0.8)' },
  cornersDotOptions: { cornerType: 'dot', color: 'rgba(0, 0, 0, 0.8)' },
})

export const downstreamOptions = (logo?: Uint8Array): QRCodeOptions => {
  const hasImage = Boolean(logo?.byteLength)
  return {
    ...downstreamBase(),
    backgroundOptions: { transparent: true },
    image: hasImage ? logo : undefined,
    imageOptions: hasImage
      ? { imageSize: 0.2, margin: 24, round: 0.2, hideBackgroundDots: true }
      : undefined,
  }
}

export const buildScenarios = (small: Uint8Array, large: Uint8Array): Scenario[] => [
  {
    name: 'baseline-png',
    probes: '默认配置 + PNG，接近库的最快路径',
    options: { data: 'https://example.com', size: 300 },
    format: 'png',
    encoding: 'binary',
  },
  {
    name: 'baseline-svg',
    probes: 'SVG 渲染，没有光栅化与图片编码',
    options: { data: 'https://example.com', size: 300 },
    format: 'svg',
    encoding: 'binary',
  },
  {
    name: 'downstream-nologo',
    probes: '下游参数但不带 Logo',
    options: downstreamOptions(),
    format: 'webp',
    encoding: 'binary',
  },
  {
    name: 'downstream-nologo-opaque',
    probes: '把透明背景换成白色，验证是否走了 resvg 光栅化慢路径',
    options: { ...downstreamBase(), backgroundOptions: { color: '#FFFFFF' } },
    format: 'webp',
    encoding: 'binary',
  },
  {
    name: 'downstream-svg',
    probes: '下游参数但只出 SVG，隔离矢量生成与光栅化的成本分界',
    options: downstreamOptions(large),
    format: 'svg',
    encoding: 'binary',
  },
  {
    name: 'downstream-logo-small',
    probes: '下游参数 + 128px Logo，验证 Logo 引入的开销',
    options: downstreamOptions(small),
    format: 'webp',
    encoding: 'binary',
  },
  {
    name: 'downstream-logo-large',
    probes: '下游参数 + 512px Logo，验证 Logo 开销是否随尺寸放大',
    options: downstreamOptions(large),
    format: 'webp',
    encoding: 'binary',
  },
  {
    name: 'downstream-logo-large-noround',
    probes: '关掉 Logo 圆角裁剪，隔离 round_logo_corners 的代价',
    options: {
      ...downstreamOptions(large),
      imageOptions: { imageSize: 0.2, margin: 24, round: 0, hideBackgroundDots: true },
    },
    format: 'webp',
    encoding: 'binary',
  },
  {
    name: 'downstream-logo-large-b64',
    probes: '下游真实调用形态（webp + base64），附加 base64 编码成本',
    options: downstreamOptions(large),
    format: 'webp',
    encoding: 'base64',
  },
  {
    name: 'downstream-logo-large-png-b64',
    probes: '改成 PNG，对比无损 WebP 编码器的代价',
    options: downstreamOptions(large),
    format: 'png',
    encoding: 'base64',
  },
  {
    name: 'downstream-logo-large-jpeg-b64',
    probes: '改成 JPEG，对比有损编码器能否把透明路径拉回白底路径的速度',
    options: downstreamOptions(large),
    format: 'jpeg',
    encoding: 'base64',
  },
  {
    name: 'downstream-size500',
    probes: '下游参数减半尺寸，验证耗时是否随像素数平方增长',
    options: { ...downstreamOptions(large), size: 500 },
    format: 'webp',
    encoding: 'base64',
  },
  {
    name: 'downstream-size2000',
    probes: '下游参数翻倍尺寸，验证大尺寸下的光栅化与编码代价',
    options: { ...downstreamOptions(large), size: 2000 },
    format: 'webp',
    encoding: 'base64',
  },
]
