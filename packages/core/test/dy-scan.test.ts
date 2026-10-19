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
})
