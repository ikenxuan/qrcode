import { describe, it, expect } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync, crc32 } from 'node:zlib'

/**
 * 手写一张纯色 RGB PNG 作为 Logo 素材。
 *
 * 刻意不用库自身生成二维码当 Logo —— 那会在图片中心嵌入一个真实可解码的
 * 二维码，导致扫描时锁定内层 Logo 而非外层内容。纯色图片无定位图案，
 * 既零依赖又能让 Logo 扫描测试稳定。
 */
const makeSolidPng = (w: number, h: number, [r, g, b]: [number, number, number]): Uint8Array => {
  const chunk = (type: string, data: Buffer): Buffer => {
    const typeBuf = Buffer.from(type, 'ascii')
    const lenBuf = Buffer.alloc(4)
    lenBuf.writeUInt32BE(data.length)
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0)
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: RGB
  const stride = w * 3
  const raw = Buffer.alloc((stride + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    for (let x = 0; x < w; x++) {
      const o = y * (stride + 1) + 1 + x * 3
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
    }
  }
  const idat = deflateSync(raw)
  return new Uint8Array(Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]))
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, 'output')
mkdirSync(outDir, { recursive: true })

describe('generate - 基础功能', () => {
  it('import 即用，无需初始化', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const buf = generate({ data: 'https://example.com' }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
    expect(buf[0]).toBe(0x89)
  })

  it('支持字符串字面量参数', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'https://example.com',
      shape: 'square',
      dotsOptions: { dotType: 'rounded' },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
    expect(buf[0]).toBe(0x89)
  })

  it('支持常量对象参数', async () => {
    const { generateSync: generate, OutputFormat, ShapeType, DotType } = await import('../dist/index.js')
    const buf = generate({
      data: 'https://example.com',
      shape: ShapeType.Square,
      dotsOptions: { dotType: DotType.Rounded },
    }, OutputFormat.Png)
    expect(buf).toBeInstanceOf(Uint8Array)
    expect(buf[0]).toBe(0x89)
  })
})

describe('async API', () => {
  it('generate / generateSvg / scan 返回 Promise 并可正常工作', async () => {
    const { generate, generateSvg, scan } = await import('../dist/index.js')

    const pngPromise = generate({ data: 'https://example.com' }, 'png')
    expect(pngPromise).toBeInstanceOf(Promise)

    const png = await pngPromise
    expect(png).toBeInstanceOf(Uint8Array)
    expect(png[0]).toBe(0x89)

    await expect(generateSvg({ data: 'https://example.com' })).resolves.toContain('<svg')
    await expect(scan(png)).resolves.toBe('https://example.com')
  })
})

describe('generate - 输出格式', () => {
  it('png', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const buf = generate({ data: 'test' }, 'png')
    expect(buf[0]).toBe(0x89)
    writeFileSync(resolve(outDir, '01-默认.png'), buf)
  })

  it('jpeg', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const buf = generate({ data: 'test' }, 'jpeg')
    expect(buf[0]).toBe(0xff)
    writeFileSync(resolve(outDir, '02-默认.jpeg'), buf)
  })

  it('webp', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const buf = generate({ data: 'test' }, 'webp')
    expect(String.fromCharCode(...buf.slice(0, 4))).toBe('RIFF')
    writeFileSync(resolve(outDir, '03-默认.webp'), buf)
  })

  it('svg (二进制)', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const buf = generate({ data: 'test' }, 'svg')
    expect(new TextDecoder().decode(buf)).toContain('<svg')
    writeFileSync(resolve(outDir, '04-默认.svg'), buf)
  })
})

describe('generate - 编码输出', () => {
  it('base64 返回 string', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const b64 = generate({ data: 'https://example.com' }, 'png', 'base64')
    expect(typeof b64).toBe('string')
    const buf = Buffer.from(b64, 'base64')
    expect(buf[0]).toBe(0x89)
  })

  it('binary 返回 Uint8Array', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const buf = generate({ data: 'https://example.com' }, 'png', 'binary')
    expect(buf).toBeInstanceOf(Uint8Array)
  })

  it('默认返回 Uint8Array', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const buf = generate({ data: 'https://example.com' }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
  })
})

describe('generateSvg', () => {
  it('返回有效 SVG 字符串', async () => {
    const { generateSvgSync: generateSvg } = await import('../dist/index.js')
    const svg = generateSvg({ data: 'https://example.com' })
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('所有点阵类型', async () => {
    const { generateSvgSync: generateSvg, DotType } = await import('../dist/index.js')
    for (const dotType of Object.values(DotType)) {
      const svg = generateSvg({ data: 'https://example.com', dotsOptions: { dotType } })
      expect(svg).toContain('<svg')
      writeFileSync(resolve(outDir, `13-点阵类型-${dotType}.svg`), svg)
    }
  })
})

describe('generate - 样式组合', () => {
  it('圆形 + 渐变 + 透明背景', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'https://github.com/ikenxuan',
      size: 400,
      shape: 'circle',
      dotsOptions: { dotType: 'dots', gradient: { colorFrom: '#667eea', colorTo: '#764ba2' } },
      cornersSquareOptions: { cornerType: 'extra-rounded', color: '#667eea' },
      backgroundOptions: { transparent: true },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
    writeFileSync(resolve(outDir, '16-透明背景-圆形渐变.png'), buf)
  })

  it('全配置组合', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'https://github.com/ikenxuan',
      size: 400,
      margin: 20,
      shape: 'square',
      dotsOptions: { dotType: 'classy-rounded', gradient: { colorFrom: '#ff6b6b', colorTo: '#feca57' } },
      cornersSquareOptions: { cornerType: 'dot', color: '#ff6b6b' },
      cornersDotOptions: { cornerType: 'dot', color: '#feca57' },
      backgroundOptions: { color: '#1a1a2e' },
    }, 'png')
    expect(buf.length).toBeGreaterThan(0)
    writeFileSync(resolve(outDir, '11-全配置组合.png'), buf)
  })
})

describe('generate - 颜色格式支持', () => {
  it('rgba() 半透明颜色', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'test',
      dotsOptions: { dotType: 'rounded', color: 'rgba(0, 0, 0, 0.5)' },
      backgroundOptions: { transparent: true },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
    expect(buf[0]).toBe(0x89)
    writeFileSync(resolve(outDir, '18-rgba半透明.png'), buf)
  })

  it('rgb() 颜色', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'test',
      dotsOptions: { dotType: 'rounded', color: 'rgb(255, 0, 128)' },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
  })

  it('rgb() CSS4 空格语法带 alpha', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'test',
      dotsOptions: { dotType: 'rounded', color: 'rgb(255 0 0 / 0.5)' },
      backgroundOptions: { transparent: true },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
  })

  it('hsl() 颜色', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'test',
      dotsOptions: { dotType: 'rounded', color: 'hsl(240, 100%, 50%)' },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
  })

  it('hsla() 半透明颜色', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'test',
      dotsOptions: { dotType: 'rounded', color: 'hsla(0, 100%, 50%, 0.5)' },
      backgroundOptions: { transparent: true },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
  })

  it('hsl() CSS4 空格语法带 alpha', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'test',
      dotsOptions: { dotType: 'dots', color: 'hsl(120deg 80% 40% / 0.7)' },
      backgroundOptions: { transparent: true },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
  })

  it('oklab() 颜色', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'test',
      dotsOptions: { dotType: 'rounded', color: 'oklab(0.5 0.1 -0.1)' },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
  })

  it('oklab() 带 alpha', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'test',
      dotsOptions: { dotType: 'rounded', color: 'oklab(0.5 0.1 -0.1 / 0.6)' },
      backgroundOptions: { transparent: true },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
  })

  it('oklch() 颜色', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'test',
      dotsOptions: { dotType: 'rounded', color: 'oklch(0.7 0.15 150)' },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
    writeFileSync(resolve(outDir, '19-oklch颜色.png'), buf)
  })

  it('oklch() 带 deg 和 alpha', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'test',
      dotsOptions: { dotType: 'dots', color: 'oklch(0.6 0.2 30deg / 50%)' },
      backgroundOptions: { transparent: true },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
  })

  it('命名颜色 transparent', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'test',
      cornersSquareOptions: { cornerType: 'extra-rounded', color: 'red' },
      cornersDotOptions: { cornerType: 'dot', color: 'blue' },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
  })

  it('多种颜色格式混合使用', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'https://github.com/ikenxuan',
      size: 400,
      dotsOptions: { dotType: 'rounded', color: 'oklch(0.6 0.15 250)' },
      cornersSquareOptions: { cornerType: 'extra-rounded', color: 'hsl(200, 80%, 50%)' },
      cornersDotOptions: { cornerType: 'dot', color: 'rgba(255, 100, 0, 0.8)' },
      backgroundOptions: { transparent: true },
    }, 'webp')
    expect(buf).toBeInstanceOf(Uint8Array)
    expect(String.fromCharCode(...buf.slice(0, 4))).toBe('RIFF')
    writeFileSync(resolve(outDir, '20-混合颜色格式.webp'), buf)
  })
})

describe('generate - Logo 嵌入', () => {
  /** 纯红色方块 Logo（无二维码定位图案，扫描稳定） */
  const makeLogo = (): Uint8Array => makeSolidPng(120, 120, [255, 0, 0])

  it('generateSvg 会把 Logo 嵌入为 base64 <image> 元素', async () => {
    const { generateSvgSync: generateSvg } = await import('../dist/index.js')
    const logo = makeLogo()

    const svgNoLogo = generateSvg({ data: 'https://example.com', size: 300 })
    expect(svgNoLogo).not.toMatch(/<image[\s>]/i)

    const svgLogo = generateSvg({
      data: 'https://example.com',
      size: 300,
      image: logo,
      imageOptions: { imageSize: 0.3, margin: 6, hideBackgroundDots: true },
    })
    // 决定性证明：二进制经 WASM 传入 Rust 并被渲染进 SVG
    expect(svgLogo).toMatch(/<image[\s>]/i)
    expect(svgLogo).toMatch(/data:image\/[a-z]+;base64,/i)
    expect(svgLogo.length).toBeGreaterThan(svgNoLogo.length)
    writeFileSync(resolve(outDir, '21-Logo嵌入.svg'), svgLogo)
  })

  it('round 会在嵌入前将 Logo 裁剪为带透明圆角的 PNG', async () => {
    const { generateSvgSync: generateSvg } = await import('../dist/index.js')
    const logo = makeLogo()
    const sourceBase64 = Buffer.from(logo).toString('base64')

    const squareSvg = generateSvg({
      data: 'https://example.com',
      image: logo,
      imageOptions: { round: 0 },
    })
    expect(squareSvg).toContain(`data:image/png;base64,${sourceBase64}`)

    const roundedSvg = generateSvg({
      data: 'https://example.com',
      image: logo,
      imageOptions: { round: 0.5 },
    })
    const embeddedImage = roundedSvg.match(/<image href="data:image\/png;base64,([^"]+)"/i)?.[1]

    expect(embeddedImage).toBeTruthy()
    expect(embeddedImage).not.toBe(sourceBase64)
    expect(Buffer.from(embeddedImage!, 'base64').subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    writeFileSync(resolve(outDir, '24-Logo圆角.svg'), roundedSvg)
  })

  it('嵌入 Logo 的 PNG 仍可被扫描解码', async () => {
    const { generateSync: generate, scanSync: scan } = await import('../dist/index.js')
    const logo = makeLogo()
    const png = generate({
      data: 'https://github.com/ikenxuan/qrcode',
      size: 400,
      image: logo,
      imageOptions: { imageSize: 0.22, margin: 6, round: 0.18, hideBackgroundDots: true },
    }, 'png')
    expect(png[0]).toBe(0x89)
    expect(scan(png)).toBe('https://github.com/ikenxuan/qrcode')
    writeFileSync(resolve(outDir, '22-Logo可扫描.png'), png)
  })

  it('hideBackgroundDots 开关均可正常生成', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const logo = makeLogo()
    for (const hide of [true, false]) {
      const buf = generate({
        data: 'https://example.com',
        size: 360,
        image: logo,
        imageOptions: { imageSize: 0.25, margin: 4, hideBackgroundDots: hide },
      }, 'png')
      expect(buf).toBeInstanceOf(Uint8Array)
      expect(buf[0]).toBe(0x89)
    }
  })

  it('仅传 image、不传 imageOptions 时使用默认参数', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const logo = makeLogo()
    const buf = generate({ data: 'https://example.com', size: 360, image: logo }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
    expect(buf[0]).toBe(0x89)
  })

  it('Logo + 渐变点阵 + 透明背景组合', async () => {
    const { generateSync: generate } = await import('../dist/index.js')
    const logo = makeLogo()
    const buf = generate({
      data: 'https://github.com/ikenxuan/qrcode',
      size: 420,
      shape: 'circle',
      dotsOptions: { dotType: 'dots', gradient: { colorFrom: '#667eea', colorTo: '#764ba2' } },
      image: logo,
      imageOptions: { imageSize: 0.2, margin: 8, hideBackgroundDots: true },
      backgroundOptions: { transparent: true },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
    writeFileSync(resolve(outDir, '23-Logo渐变透明组合.png'), buf)
  })
})

describe('scan - 二维码扫描', () => {
  it('扫描 PNG 格式二维码', async () => {
    const { generateSync: generate, scanSync: scan } = await import('../dist/index.js')
    const png = generate({ data: 'https://example.com' }, 'png')
    const result = scan(png)
    expect(result).toBe('https://example.com')
  })

  it('扫描 WebP 格式二维码', async () => {
    const { generateSync: generate, scanSync: scan } = await import('../dist/index.js')
    const webp = generate({ data: 'hello world' }, 'webp')
    const result = scan(webp)
    expect(result).toBe('hello world')
  })

  it('扫描带样式的二维码', async () => {
    const { generateSync: generate, scanSync: scan } = await import('../dist/index.js')
    const buf = generate({
      data: 'https://github.com/ikenxuan',
      size: 400,
      dotsOptions: { dotType: 'square', color: '#333333' },
      cornersSquareOptions: { cornerType: 'square', color: '#667eea' },
    }, 'png')
    const result = scan(buf)
    expect(result).toBe('https://github.com/ikenxuan')
  })

  it('扫描透明背景二维码', async () => {
    const { generateSync: generate, scanSync: scan } = await import('../dist/index.js')
    const buf = generate({
      data: 'transparent-test',
      backgroundOptions: { transparent: true },
    }, 'png')
    const result = scan(buf)
    expect(result).toBe('transparent-test')
  })

  it('无效图片数据返回 null', async () => {
    const { scanSync: scan } = await import('../dist/index.js')
    const result = scan(new Uint8Array([0, 1, 2, 3]))
    expect(result).toBeNull()
  })
})
