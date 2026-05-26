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
