/**
 * 对比两份构建产物的输出是否逐字节一致。
 *
 * 用途：调整构建参数（优化等级、SIMD、LTO……）或升级 WASM 依赖后，先用它确认
 * 渲染结果没有变化，再去看基准数据——否则「变快了」可能只是少画了东西。
 *
 *   node benchmark/compare-builds.ts <优化前的 dist/index.js> [优化后的 dist/index.js]
 *
 * 第二项省略时取本包的 dist/index.js。产物可以用 `pnpm build:core` 前后各拷贝一份留存。
 */
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { smallLogo, largeLogo } from './fixtures.ts'
import type { Encoding, OutputFormat, QRCodeOptions } from '../dist/index.js'

interface Api {
  generateSync: (options: QRCodeOptions, format: OutputFormat, encoding?: Encoding) => Uint8Array | string
  scanSync: (imageData: Uint8Array) => string | null
}

const [beforePath, afterPath] = process.argv.slice(2)
if (!beforePath) {
  console.error('用法：node benchmark/compare-builds.ts <优化前的 dist/index.js> [优化后的 dist/index.js]')
  process.exit(1)
}

const load = async (label: string, path: string): Promise<Api> => {
  const url = pathToFileURL(resolve(path)).href
  try {
    return (await import(url)) as Api
  } catch (error) {
    console.error(`加载${label}产物失败：${url}`)
    throw error
  }
}

const before = await load('优化前', beforePath)
const after = await load('优化后', afterPath ?? resolve(import.meta.dirname, '../dist/index.js'))

const small = smallLogo()
const large = largeLogo()

const cases: Array<[string, QRCodeOptions, OutputFormat, Encoding]> = [
  ['默认 png', { data: 'https://example.com', size: 300 }, 'png', 'binary'],
  ['圆点 + 渐变 webp', { data: 'https://example.com', size: 400, dotsOptions: { dotType: 'dots', gradient: { colorFrom: '#667eea', colorTo: '#764ba2' } } }, 'webp', 'binary'],
  ['圆形 + 透明 png', { data: 'https://example.com', size: 300, shape: 'circle', backgroundOptions: { transparent: true } }, 'png', 'binary'],
  ['oklch 颜色', { data: 'https://example.com', size: 300, dotsOptions: { dotType: 'rounded', color: 'oklch(0.6 0.2 30)' } }, 'png', 'binary'],
  ['128px logo 圆角 0.2', { data: 'https://example.com', size: 500, image: small, imageOptions: { imageSize: 0.3, margin: 10, round: 0.2, hideBackgroundDots: true } }, 'png', 'binary'],
  ['512px logo + 透明 webp + base64', { data: 'https://example.com', size: 1000, image: large, imageOptions: { imageSize: 0.2, margin: 24, round: 0.2, hideBackgroundDots: true }, backgroundOptions: { transparent: true } }, 'webp', 'base64'],
  ['jpeg 输出', { data: 'https://example.com', size: 400 }, 'jpeg', 'binary'],
  ['svg 输出', { data: 'https://example.com', size: 300, dotsOptions: { dotType: 'classy-rounded' } }, 'svg', 'binary'],
  ['超大尺寸 2000 png', { data: 'https://example.com', size: 2000 }, 'png', 'binary'],
]

const toBuffer = (value: Uint8Array | string): Buffer =>
  typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(value)

const digest = (buffer: Buffer): string => createHash('sha256').update(buffer).digest('hex').slice(0, 16)

let mismatches = 0
const nameWidth = Math.max(...cases.map(([name]) => name.length), 8)
console.log(`${'场景'.padEnd(nameWidth)}  结果  优化前     优化后     sha256(前/后)`)

for (const [name, options, format, encoding] of cases) {
  const beforeBuf = toBuffer(before.generateSync(options, format, encoding))
  const afterBuf = toBuffer(after.generateSync(options, format, encoding))
  const same = beforeBuf.equals(afterBuf)
  if (!same) mismatches++

  console.log([
    name.padEnd(nameWidth),
    same ? ' 一致' : ' 不同',
    `${beforeBuf.length}B`.padStart(9),
    `${afterBuf.length}B`.padStart(9),
    `${digest(beforeBuf)} / ${digest(afterBuf)}`,
  ].join('  '))
}

// 顺带确认新产物生成出来的二维码仍能被自己扫回原文
const payload = 'https://compare-builds.example/roundtrip'
const decoded = after.scanSync(after.generateSync({ data: payload, size: 500 }, 'png') as Uint8Array)
const roundTripOk = decoded === payload

console.log(`\n扫描回读：${decoded ?? '(未识别)'} ${roundTripOk ? '✓' : '✗'}`)
console.log(`结论：${mismatches === 0 ? '全部场景字节一致' : `${mismatches} 个场景输出不同`}`)

if (mismatches > 0 || !roundTripOk) process.exitCode = 1
