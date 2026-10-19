import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 抖音码的端到端回归。
 *
 * 抖音码没有标准 QR 的定位图案，`scan` 在常规 rxing 解码失败后会改走
 * `packages/wasm/src/dy` 的环采样解码路径。样本来自真实抖音分享码。
 */
const __dirname = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(resolve(__dirname, 'fixtures', name)))

describe('scan - 抖音码', () => {
  it('扫描作品分享码样本', async () => {
    const { scanSync } = await import('../dist/index.js')
    expect(scanSync(fixture('dy-work-share.png'))).toBe('https://v.douyin.com/utbKgTJRmlI/')
  })

  it('扫描第二个真实样本', async () => {
    const { scanSync } = await import('../dist/index.js')
    expect(scanSync(fixture('dy-sample-2.png'))).toBe('https://v.douyin.com/bU3KRLRB9CE/')
  })

  it('扫描低分辨率截图样本', async () => {
    const { scanDetailedSync } = await import('../dist/index.js')
    const result = scanDetailedSync(fixture('dy-low-res.png'))

    expect(result?.text).toBe('https://v.douyin.com/8GS95xmDe_Q/')
    expect(result?.circle).not.toBeNull()
    expect(result!.circle!.r).toBeGreaterThan(0)
  })

  it('在深色弹窗截图中定位到较小的码', async () => {
    // 码心暗盘不是画面里最大的暗色块，定位器需要枚举所有近圆形的暗块。
    const { scanDetailedSync } = await import('../dist/index.js')
    const result = scanDetailedSync(fixture('dy-busy-background.jpg'))

    expect(result?.text).toBe('https://v.douyin.com/utbKgTJRmlI/')
    expect(result?.circle).not.toBeNull()
    expect(result!.circle!.cx).toBeGreaterThan(330)
    expect(result!.circle!.cx).toBeLessThan(360)
    expect(result!.circle!.cy).toBeGreaterThan(785)
    expect(result!.circle!.cy).toBeLessThan(815)
  })

  it('大截图中较小的码也能解码', async () => {
    // 整图边长超过放大回退的阈值，解码器需要只放大码所在区域。
    const { scanDetailedSync } = await import('../dist/index.js')
    const result = scanDetailedSync(fixture('dy-large-screenshot.png'))

    expect(result?.text).toBe('https://v.douyin.com/utbKgTJRmlI/')
    expect(result?.circle).not.toBeNull()
    expect(result!.circle!.cx).toBeGreaterThan(990)
    expect(result!.circle!.cx).toBeLessThan(1020)
    expect(result!.circle!.cy).toBeGreaterThan(785)
    expect(result!.circle!.cy).toBeLessThan(815)
  })

  it('异步 scan 同样支持', async () => {
    const { scan } = await import('../dist/index.js')
    await expect(scan(fixture('dy-work-share.png'))).resolves.toBe(
      'https://v.douyin.com/utbKgTJRmlI/',
    )
  })

  it('普通二维码扫描不受影响', async () => {
    const { generateSync, scanSync } = await import('../dist/index.js')
    const png = generateSync({ data: 'https://example.com/dy-fallback' }, 'png')
    expect(scanSync(png)).toBe('https://example.com/dy-fallback')
  })

  it('返回抖音码的圆形位置', async () => {
    const { scanDetailedSync } = await import('../dist/index.js')
    const result = scanDetailedSync(fixture('dy-work-share.png'))

    expect(result?.text).toBe('https://v.douyin.com/utbKgTJRmlI/')
    expect(result?.circle).not.toBeNull()
    expect(result!.circle!.r).toBeGreaterThan(0)
    // 作品分享码只有一个定位锚点：中心圆盘的圆心。
    expect(result?.points).toHaveLength(1)
    expect(result!.points[0].x).toBeCloseTo(result!.circle!.cx, 3)
    expect(result!.points[0].y).toBeCloseTo(result!.circle!.cy, 3)
  })

  it('返回标准二维码的定位点', async () => {
    const { generateSync, scanDetailedSync } = await import('../dist/index.js')
    const png = generateSync({ data: 'https://example.com/detailed' }, 'png')
    const result = scanDetailedSync(png)

    expect(result?.text).toBe('https://example.com/detailed')
    expect(result?.points.length).toBeGreaterThanOrEqual(3)
    expect(result?.circle).toBeNull()
  })
})
