/**
 * 基准测试素材：运行时生成确定性的 Logo PNG。
 *
 * 刻意不落盘二进制文件——素材由固定种子生成，任何机器上跑出的都是同一张图，
 * 这样「Logo 解码 / 圆角裁剪 / 重新编码」的耗时才可复现、可比较。
 */
import { crc32, deflateSync } from 'node:zlib'

const pngChunk = (type: string, data: Buffer): Buffer => {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

/**
 * 生成一张带径向渐变和确定性噪声的 RGB PNG。
 *
 * 纯色图会被 deflate 压成几百字节，解码路径快到测不出来；加噪声后
 * 素材体积、解码耗时都更接近真实头像，才测得出 Logo 相关开销。
 */
export const makeLogoPng = (width: number, height: number, seed = 0x5eed): Uint8Array => {
  let state = seed >>> 0
  const nextByte = (): number => {
    // xorshift32，保证同一 seed 在任何平台产生同一序列
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state & 0xff
  }

  const stride = width * 3
  const raw = Buffer.alloc((stride + 1) * height)
  const centerX = width / 2
  const centerY = height / 2
  const maxRadius = Math.hypot(centerX, centerY) || 1

  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1)
    raw[rowStart] = 0 // filter: none
    for (let x = 0; x < width; x++) {
      const radius = Math.hypot(x - centerX, y - centerY) / maxRadius
      const shade = Math.round(255 * (1 - radius) ** 2)
      const offset = rowStart + 1 + x * 3
      raw[offset] = (shade + nextByte()) & 0xff
      raw[offset + 1] = (shade * 0.6 + nextByte()) & 0xff
      raw[offset + 2] = (shade * 0.3 + nextByte()) & 0xff
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: RGB

  return new Uint8Array(
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk('IHDR', ihdr),
      pngChunk('IDAT', deflateSync(raw, { level: 6 })),
      pngChunk('IEND', Buffer.alloc(0)),
    ]),
  )
}

/** 典型头像尺寸（小红书/抖音头像多在 100~300px 之间）。 */
export const smallLogo = (): Uint8Array => makeLogoPng(128, 128)

/** 偏大的头像，用来放大 Logo 处理路径的开销。 */
export const largeLogo = (): Uint8Array => makeLogoPng(512, 512)
