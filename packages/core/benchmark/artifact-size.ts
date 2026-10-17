/**
 * 比较构建产物的交付体积：原始、gzip、brotli。
 *
 * 为什么不能只看 `.wasm` 有多大：wasm 是 base64 内联进 JS 的，消费者实际下载的是
 * 那个 JS chunk，而且是**压缩后**的体积。更小的二进制不必然对应更小的压缩体积
 * （SIMD 版就是例子：raw 小 4%，brotli 只小 0.3%）。
 *
 *   node benchmark/artifact-size.ts <标签=路径|路径> [更多...]
 *
 * 例：对比已发布版本和本地构建
 *   node benchmark/artifact-size.ts \
 *     "已发布=node_modules/@ikenxuan/qrcode/dist/sync-xxxx.js" \
 *     "本地=dist/sync-yyyy.js"
 *
 * 省略标签时用文件名。第一项作为基准，后续各项显示相对它的增减。
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('用法：node benchmark/artifact-size.ts <标签=路径|路径> [更多...]')
  process.exit(1)
}

interface Row {
  label: string
  raw: number
  gzip: number
  brotli: number
}

const rows: Row[] = args.map((arg) => {
  const separator = arg.indexOf('=')
  const label = separator > 0 ? arg.slice(0, separator) : basename(arg)
  const path = separator > 0 ? arg.slice(separator + 1) : arg
  const buf = readFileSync(path)
  return {
    label,
    raw: buf.length,
    gzip: gzipSync(buf, { level: 9 }).length,
    // 质量 11 是 CDN 上常见的 brotli 档位，比默认值更能反映真实传输量
    brotli: brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
  }
})

const kb = (bytes: number): string => `${(bytes / 1024).toFixed(0)} KB`
const labelWidth = Math.max(...rows.map((row) => row.label.length), 8)

console.log([
  '标签'.padEnd(labelWidth),
  '原始'.padStart(10),
  'gzip'.padStart(10),
  'brotli'.padStart(10),
].join('  '))

for (const row of rows) {
  console.log([
    row.label.padEnd(labelWidth),
    kb(row.raw).padStart(10),
    kb(row.gzip).padStart(10),
    kb(row.brotli).padStart(10),
  ].join('  '))
}

const [base, ...rest] = rows
const delta = (from: number, to: number): string =>
  `${to >= from ? '+' : ''}${(((to - from) / from) * 100).toFixed(1)}%`

if (rest.length > 0) {
  console.log(`\n相对「${base.label}」的变化：`)
  for (const row of rest) {
    console.log([
      `  ${row.label}`.padEnd(labelWidth + 2),
      `原始 ${delta(base.raw, row.raw)}`.padStart(16),
      `gzip ${delta(base.gzip, row.gzip)}`.padStart(16),
      `brotli ${delta(base.brotli, row.brotli)}`.padStart(18),
    ].join(''))
  }
}

console.log('\n（gzip level 9 / brotli quality 11；体积越接近 CDN 实际传输量越有参考价值）')
