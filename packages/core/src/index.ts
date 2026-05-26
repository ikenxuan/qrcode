/**
 * @module @ikenxuan/qrcode
 *
 * 基于 Rust qr-code-styling 库的高性能 QR 码生成器。
 * WASM 已内联，import 即用，Node.js 和浏览器通用。
 *
 * @packageDocumentation
 */
import { generate as _generate, generateSvg as _generateSvg } from '@ikenxuan/qrcode-wasm'
import { DotType, CornerSquareType, CornerDotType, ShapeType, OutputFormat, type QRCodeOptions, type Encoding, type GenerateResult, type Gradient, type DotsOptions, type CornersSquareOptions, type CornersDotOptions, type ImageOptions, type BackgroundOptions } from './types.js'

export { DotType, CornerSquareType, CornerDotType, ShapeType, OutputFormat }
export type { Gradient, DotsOptions, CornersSquareOptions, CornersDotOptions, ImageOptions, BackgroundOptions, QRCodeOptions, Encoding, GenerateResult }

function toBase64 (buf: Uint8Array<ArrayBuffer>): string {
  let binary = ''
  for (let i = 0; i < buf.length; i++) {
    binary += String.fromCharCode(buf[i])
  }
  return btoa(binary)
}

/**
 * 生成 QR 码
 *
 * @param options - QR 码生成配置
 * @param format - 输出格式
 * @param encoding - 编码方式，默认 `'binary'`
 * @returns 根据 encoding 返回 `Uint8Array`（binary）或 base64 `string`
 */
export function generate<E extends Encoding = 'binary'> (
  options: QRCodeOptions,
  format: OutputFormat,
  encoding?: E,
): GenerateResult<E> {
  const buf = _generate(options, format) as Uint8Array<ArrayBuffer>
  return (encoding === 'base64' ? toBase64(buf) : buf) as GenerateResult<E>
}

/**
 * 生成 QR 码 SVG 字符串
 *
 * @param options - QR 码生成配置
 * @returns SVG 格式的字符串
 */
export function generateSvg (options: QRCodeOptions): string {
  return _generateSvg(options)
}
