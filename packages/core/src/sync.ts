import { generate as _generate, generateSvg as _generateSvg, scan as _scan } from '@ikenxuan/qrcode-wasm'
import type { Encoding, GenerateResult, OutputFormat, QRCodeOptions } from './types.js'

const toBase64 = (buf: Uint8Array<ArrayBuffer>): string => {
  let binary = ''
  for (let i = 0; i < buf.length; i++) {
    binary += String.fromCharCode(buf[i])
  }
  return btoa(binary)
}

/**
 * 同步生成 QR 码。
 *
 * @remarks
 * 该函数直接调用内联 WASM，并在当前线程完成二维码编码和图片渲染。
 * 适合脚本、小批量任务或浏览器入口；在 Node.js 服务中需要避免阻塞时，
 * 优先使用默认异步 API `generate`。
 *
 * @example
 * ```ts
 * import { generateSync } from '@ikenxuan/qrcode'
 *
 * const png = generateSync({ data: 'https://example.com' }, 'png')
 * ```
 *
 * @param options - QR 码生成配置。
 * @param format - 输出格式，支持 `'svg'`、`'png'`、`'jpeg'`、`'webp'`。
 * @param encoding - 编码方式，默认 `'binary'`。
 * @returns 根据 encoding 返回 `Uint8Array`（binary）或 base64 `string`。
 */
export const generateSync = <E extends Encoding = 'binary'> (
  options: QRCodeOptions,
  format: OutputFormat,
  encoding?: E,
): GenerateResult<E> => {
  const buf = _generate(options, format) as Uint8Array<ArrayBuffer>
  return (encoding === 'base64' ? toBase64(buf) : buf) as GenerateResult<E>
}

/**
 * 同步生成 QR 码 SVG 字符串。
 *
 * @remarks
 * 该函数直接调用 WASM SVG 渲染并立即返回字符串。
 *
 * @param options - QR 码生成配置。
 * @returns SVG 字符串。
 */
export const generateSvgSync = (options: QRCodeOptions): string => {
  return _generateSvg(options)
}

/**
 * 同步扫描图片中的 QR 码。
 *
 * @remarks
 * 支持 PNG、JPEG、WebP 格式图片数据。函数会在当前线程内完成图片解码、
 * 透明背景合成、预处理和 QR 解码。
 *
 * @param imageData - 图片文件的二进制数据。
 * @returns QR 码内容字符串，未识别到则返回 `null`。
 */
export const scanSync = (imageData: Uint8Array): string | null => {
  return _scan(imageData) ?? null
}
