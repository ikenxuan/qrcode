import { describe, it, expect } from 'vitest'

/**
 * 抖音码生成的端到端回归：生成 → 用同一套解码器扫回原文。
 */
describe('generateDy - 抖音码', () => {
  const url = 'https://v.douyin.com/utbKgTJRmlI/'

  it('默认样式可以解码回原文', async () => {
    const { generateDySync, scanDetailedSync } = await import('../dist/index.js')
    const png = generateDySync({ data: url })
    const result = scanDetailedSync(png)

    expect(result?.text).toBe(url)
    expect(result?.circle).not.toBeNull()
    expect(result?.points).toHaveLength(1)
  })

  it('默认输出边长与官方比例一致', async () => {
    const { generateDySync, scanDetailedSync } = await import('../dist/index.js')
    const result = scanDetailedSync(generateDySync({ data: url }))

    // 2 × (109 × 1.833 + 16) 向上取整。
    expect(result?.width).toBe(432)
    expect(result?.height).toBe(432)
  })

  it('支持指定输出尺寸', async () => {
    const { generateDySync, scanDetailedSync } = await import('../dist/index.js')
    const result = scanDetailedSync(generateDySync({ data: url, size: 400 }))

    expect(result?.text).toBe(url)
    expect(result?.width).toBe(400)
    expect(result?.height).toBe(400)
  })

  it('支持中文内容', async () => {
    const { generateDySync, scanDetailedSync } = await import('../dist/index.js')
    const text = '抖音码测试'
    const result = scanDetailedSync(generateDySync({ data: text }))

    expect(result?.text).toBe(text)
  })

  it('支持自定义颜色与模块形状', async () => {
    const { generateDySync, scanDetailedSync } = await import('../dist/index.js')
    const png = generateDySync({
      data: url,
      size: 420,
      darkColor: '#1f3a5f',
      lightColor: '#f7f2e8',
      moduleStyle: 'square',
      frame: false,
      logo: false,
    })

    expect(scanDetailedSync(png)?.text).toBe(url)
  })

  it('支持其它格式码', async () => {
    const { generateDySync, scanDetailedSync } = await import('../dist/index.js')
    const result = scanDetailedSync(generateDySync({ data: 'hello', formatCode: 1 }))

    expect(result?.text).toBe('hello')
  })

  it('支持右上角图片槽位', async () => {
    const { generateSync, generateDySync, scanDetailedSync } = await import('../dist/index.js')
    const badge = generateSync({ data: 'badge' }, 'png')
    const png = generateDySync({ data: url, badgeImage: badge })

    expect(scanDetailedSync(png)?.text).toBe(url)
  })

  it('base64 输出可以直接作为图片数据扫描', async () => {
    const { generateDySync, scanSync } = await import('../dist/index.js')
    const base64 = generateDySync({ data: url }, 'png', 'base64')

    expect(typeof base64).toBe('string')
    expect(scanSync(new Uint8Array(Buffer.from(base64, 'base64')))).toBe(url)
  })

  it('支持 WebP 与 JPEG 输出', async () => {
    const { generateDySync, scanSync } = await import('../dist/index.js')
    const webp = generateDySync({ data: url }, 'webp')
    const jpeg = generateDySync({ data: url }, 'jpeg')

    expect(scanSync(webp)).toBe(url)
    expect(scanSync(jpeg)).toBe(url)
  })

  it('支持 SVG 输出', async () => {
    const { generateDySvgSync } = await import('../dist/index.js')
    const svg = generateDySvgSync({ data: url })

    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('</svg>')
  })

  it('支持透明背景', async () => {
    const { generateDySync, scanSync } = await import('../dist/index.js')
    const png = generateDySync({ data: url, transparent: true })

    expect(scanSync(png)).toBe(url)
  })

  it('支持模块圆角与图片半径', async () => {
    const { generateSync, generateDySync, scanSync } = await import('../dist/index.js')
    const badge = generateSync({ data: 'badge' }, 'png')
    const png = generateDySync({
      data: url,
      moduleRadius: 2,
      badgeRadius: 18,
      badgeImage: badge,
    })

    expect(scanSync(png)).toBe(url)
  })

  it('支持全部外圈样式', async () => {
    const { generateDySync, scanSync } = await import('../dist/index.js')
    const styles = [
      'arcs',
      'ring',
      'dashes',
      'dots',
      'ticks',
      'double',
      'segments',
      'spark',
      'orbit',
      'gear',
    ] as const

    for (const frameStyle of styles) {
      const png = generateDySync({
        data: url,
        frameStyle,
        frameWidth: 10,
        frameRadius: 3,
        frameSpan: 80,
        frameCount: 28,
      })

      expect(scanSync(png), frameStyle).toBe(url)
    }
  })

  it('支持中心图片并保持可扫描', async () => {
    const { generateSync, generateDySync, scanSync } = await import('../dist/index.js')
    const avatar = generateSync({ data: 'center image', size: 160 }, 'png')
    const png = generateDySync({ data: url, centerImage: avatar })

    expect(scanSync(png)).toBe(url)
  })

  it('异步 generateDy 同样支持', async () => {
    const { generateDy, scanSync } = await import('../dist/index.js')
    const png = await generateDy({ data: url })

    expect(scanSync(png)).toBe(url)
  })

  it('异步 generateDySvg 返回字符串', async () => {
    const { generateDySvg } = await import('../dist/index.js')
    const svg = await generateDySvg({ data: url })

    expect(svg.startsWith('<svg')).toBe(true)
  })

  it('文本超过容量时抛错', async () => {
    const { generateDySync } = await import('../dist/index.js')

    expect(() => generateDySync({ data: 'x'.repeat(39) })).toThrow(/文本过长/)
  })

  it('空文本抛错', async () => {
    const { generateDySync } = await import('../dist/index.js')

    expect(() => generateDySync({ data: '' })).toThrow(/不能为空/)
  })
})
