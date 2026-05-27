import { describe, it, expect } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, 'output')
mkdirSync(outDir, { recursive: true })

describe('generate - 基础功能', () => {
  it('import 即用，无需初始化', async () => {
    const { generate } = await import('../dist/index.js')
    const buf = generate({ data: 'https://example.com' }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
    expect(buf[0]).toBe(0x89)
  })

  it('支持字符串字面量参数', async () => {
    const { generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'https://example.com',
      shape: 'square',
      dotsOptions: { dotType: 'rounded' },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
    expect(buf[0]).toBe(0x89)
  })

  it('支持常量对象参数', async () => {
    const { generate, OutputFormat, ShapeType, DotType } = await import('../dist/index.js')
    const buf = generate({
      data: 'https://example.com',
      shape: ShapeType.Square,
      dotsOptions: { dotType: DotType.Rounded },
    }, OutputFormat.Png)
    expect(buf).toBeInstanceOf(Uint8Array)
    expect(buf[0]).toBe(0x89)
  })
})

describe('generate - 输出格式', () => {
  it('png', async () => {
    const { generate } = await import('../dist/index.js')
    const buf = generate({ data: 'test' }, 'png')
    expect(buf[0]).toBe(0x89)
    writeFileSync(resolve(outDir, '01-默认.png'), buf)
  })

  it('jpeg', async () => {
    const { generate } = await import('../dist/index.js')
    const buf = generate({ data: 'test' }, 'jpeg')
    expect(buf[0]).toBe(0xff)
    writeFileSync(resolve(outDir, '02-默认.jpeg'), buf)
  })

  it('webp', async () => {
    const { generate } = await import('../dist/index.js')
    const buf = generate({ data: 'test' }, 'webp')
    expect(String.fromCharCode(...buf.slice(0, 4))).toBe('RIFF')
    writeFileSync(resolve(outDir, '03-默认.webp'), buf)
  })

  it('svg (二进制)', async () => {
    const { generate } = await import('../dist/index.js')
    const buf = generate({ data: 'test' }, 'svg')
    expect(new TextDecoder().decode(buf)).toContain('<svg')
    writeFileSync(resolve(outDir, '04-默认.svg'), buf)
  })
})

describe('generate - 编码输出', () => {
  it('base64 返回 string', async () => {
    const { generate } = await import('../dist/index.js')
    const b64 = generate({ data: 'https://example.com' }, 'png', 'base64')
    expect(typeof b64).toBe('string')
    const buf = Buffer.from(b64, 'base64')
    expect(buf[0]).toBe(0x89)
  })

  it('binary 返回 Uint8Array', async () => {
    const { generate } = await import('../dist/index.js')
    const buf = generate({ data: 'https://example.com' }, 'png', 'binary')
    expect(buf).toBeInstanceOf(Uint8Array)
  })

  it('默认返回 Uint8Array', async () => {
    const { generate } = await import('../dist/index.js')
    const buf = generate({ data: 'https://example.com' }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
  })
})

describe('generateSvg', () => {
  it('返回有效 SVG 字符串', async () => {
    const { generateSvg } = await import('../dist/index.js')
    const svg = generateSvg({ data: 'https://example.com' })
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('所有点阵类型', async () => {
    const { generateSvg, DotType } = await import('../dist/index.js')
    for (const dotType of Object.values(DotType)) {
      const svg = generateSvg({ data: 'https://example.com', dotsOptions: { dotType } })
      expect(svg).toContain('<svg')
      writeFileSync(resolve(outDir, `13-点阵类型-${dotType}.svg`), svg)
    }
  })
})

describe('generate - 样式组合', () => {
  it('圆形 + 渐变 + 透明背景', async () => {
    const { generate } = await import('../dist/index.js')
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
    const { generate } = await import('../dist/index.js')
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
    const { generate } = await import('../dist/index.js')
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
    const { generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'test',
      dotsOptions: { dotType: 'rounded', color: 'rgb(255, 0, 128)' },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
  })

  it('rgb() CSS4 空格语法带 alpha', async () => {
    const { generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'test',
      dotsOptions: { dotType: 'rounded', color: 'rgb(255 0 0 / 0.5)' },
      backgroundOptions: { transparent: true },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
  })

  it('hsl() 颜色', async () => {
    const { generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'test',
      dotsOptions: { dotType: 'rounded', color: 'hsl(240, 100%, 50%)' },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
  })

  it('hsla() 半透明颜色', async () => {
    const { generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'test',
      dotsOptions: { dotType: 'rounded', color: 'hsla(0, 100%, 50%, 0.5)' },
      backgroundOptions: { transparent: true },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
  })

  it('hsl() CSS4 空格语法带 alpha', async () => {
    const { generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'test',
      dotsOptions: { dotType: 'dots', color: 'hsl(120deg 80% 40% / 0.7)' },
      backgroundOptions: { transparent: true },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
  })

  it('oklab() 颜色', async () => {
    const { generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'test',
      dotsOptions: { dotType: 'rounded', color: 'oklab(0.5 0.1 -0.1)' },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
  })

  it('oklab() 带 alpha', async () => {
    const { generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'test',
      dotsOptions: { dotType: 'rounded', color: 'oklab(0.5 0.1 -0.1 / 0.6)' },
      backgroundOptions: { transparent: true },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
  })

  it('oklch() 颜色', async () => {
    const { generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'test',
      dotsOptions: { dotType: 'rounded', color: 'oklch(0.7 0.15 150)' },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
    writeFileSync(resolve(outDir, '19-oklch颜色.png'), buf)
  })

  it('oklch() 带 deg 和 alpha', async () => {
    const { generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'test',
      dotsOptions: { dotType: 'dots', color: 'oklch(0.6 0.2 30deg / 50%)' },
      backgroundOptions: { transparent: true },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
  })

  it('命名颜色 transparent', async () => {
    const { generate } = await import('../dist/index.js')
    const buf = generate({
      data: 'test',
      cornersSquareOptions: { cornerType: 'extra-rounded', color: 'red' },
      cornersDotOptions: { cornerType: 'dot', color: 'blue' },
    }, 'png')
    expect(buf).toBeInstanceOf(Uint8Array)
  })

  it('多种颜色格式混合使用', async () => {
    const { generate } = await import('../dist/index.js')
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

describe('scan - 二维码扫描', () => {
  it('扫描 PNG 格式二维码', async () => {
    const { generate, scan } = await import('../dist/index.js')
    const png = generate({ data: 'https://example.com' }, 'png')
    const result = scan(png)
    expect(result).toBe('https://example.com')
  })

  it('扫描 WebP 格式二维码', async () => {
    const { generate, scan } = await import('../dist/index.js')
    const webp = generate({ data: 'hello world' }, 'webp')
    const result = scan(webp)
    expect(result).toBe('hello world')
  })

  it('扫描带样式的二维码', async () => {
    const { generate, scan } = await import('../dist/index.js')
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
    const { generate, scan } = await import('../dist/index.js')
    const buf = generate({
      data: 'transparent-test',
      backgroundOptions: { transparent: true },
    }, 'png')
    const result = scan(buf)
    expect(result).toBe('transparent-test')
  })

  it('无效图片数据返回 null', async () => {
    const { scan } = await import('../dist/index.js')
    const result = scan(new Uint8Array([0, 1, 2, 3]))
    expect(result).toBeNull()
  })
})
