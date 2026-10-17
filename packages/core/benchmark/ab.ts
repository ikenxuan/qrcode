/**
 * 同一进程内交替测量两份产物，用于「改动到底快了多少」这类对照。
 *
 * 为什么不用 `run.ts` 跑两遍：开发机上别的进程会随时抢 CPU，两次独立运行的
 * 环境并不相同，差值里混着负载漂移。这里 A、B 交替采样（每轮 A 一次、B 一次），
 * 两边承受同样的干扰，取各自最快的一次做对比。
 *
 *   node --expose-gc benchmark/ab.ts <A 的 dist/index.js> <B 的 dist/index.js> [轮数]
 *
 * 例：改构建参数前后各留一份产物，比一比
 *   cp -r dist /tmp/qrcode-dist-before
 *   pnpm build:core
 *   node --expose-gc benchmark/ab.ts /tmp/qrcode-dist-before/dist/index.js dist/index.js
 *
 * 默认只跑最关键的四个场景（下游真实形态、无 logo、大 logo、React 二次渲染），
 * 完整场景表看 `run.ts`。搭配 `compare-builds.ts` 一起用：先确认输出没变，再比快慢。
 */
import { performance } from 'node:perf_hooks'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { formatMs } from './stats.ts'
import { smallLogo, largeLogo } from './fixtures.ts'
import { downstreamOptions } from './scenarios.ts'
import type { Encoding, OutputFormat, QRCodeOptions } from '../dist/index.js'

const [pathA, pathB] = process.argv.slice(2)
if (!pathA || !pathB) {
  console.error('用法：node --expose-gc benchmark/ab.ts <A/dist/index.js> <B/dist/index.js>')
  process.exit(1)
}

/** 按路径动态加载的产物，用本包 dist 的类型做编译期约束（同 compare-builds.ts）。 */
interface Api {
  generateSync: (options: QRCodeOptions, format: OutputFormat, encoding?: Encoding) => Uint8Array | string
}

const rounds = Number(process.argv[4] ?? 9)
const load = async (path: string): Promise<Api> =>
  (await import(pathToFileURL(resolve(path)).href)) as Api

const A = await load(pathA)
const B = await load(pathB)

const small = smallLogo()
const large = largeLogo()
const h = React.createElement
const SHARE_URL = 'https://www.xiaohongshu.com/user/profile/5f3b1c0e000000000100abcd?xsec_token=AB1cdEF2gh'

const poster = (children: React.ReactNode) =>
  h('div', { className: 'poster' },
    h('h1', null, '小红书扫码登录'),
    h('div', { style: { width: '800px', height: '800px' } }, children),
    h('p', null, '此二维码 3 分钟内有效，请及时扫码登录。'))

const makeRunner = (api: typeof A, image?: Uint8Array) => {
  const qr = (avatar?: Uint8Array) =>
    h('img', {
      src: `data:image/webp;base64,${api.generateSync({ ...downstreamOptions(avatar), data: SHARE_URL }, 'webp', 'base64')}`,
      alt: '二维码',
    })
  return () => {
    renderToString(poster(qr()))
    return renderToString(poster(qr(image))).length
  }
}

const scenarios: Array<{ name: string; make: (api: typeof A) => () => number }> = [
  {
    name: 'qr-1000 无 logo',
    make: (api) => () => {
      const out = api.generateSync({ ...downstreamOptions(), data: SHARE_URL }, 'webp', 'base64')
      return typeof out === 'string' ? out.length : out.byteLength
    },
  },
  {
    name: 'qr-1000 +128px logo（下游形态）',
    make: (api) => () => {
      const out = api.generateSync({ ...downstreamOptions(small), data: SHARE_URL }, 'webp', 'base64')
      return typeof out === 'string' ? out.length : out.byteLength
    },
  },
  {
    name: 'qr-1000 +512px logo',
    make: (api) => () => {
      const out = api.generateSync({ ...downstreamOptions(large), data: SHARE_URL }, 'webp', 'base64')
      return typeof out === 'string' ? out.length : out.byteLength
    },
  },
  {
    name: 'react 二次渲染（开发预览形态）',
    make: (api) => makeRunner(api, small),
  },
]

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}
const min = (values: number[]) => Math.min(...values)

console.log(`\n交替测量 ${rounds} 轮，A = ${pathA}\n                B = ${pathB}\n`)
console.log(`${'场景'.padEnd(34)}${'A 最快'.padStart(11)}${'B 最快'.padStart(11)}${'加速'.padStart(9)}   ${'A 中位'.padStart(10)}${'B 中位'.padStart(10)}`)

for (const scenario of scenarios) {
  const runA = scenario.make(A)
  const runB = scenario.make(B)
  const samplesA: number[] = []
  const samplesB: number[] = []

  runA(); runB() // 预热

  for (let i = 0; i < rounds; i++) {
    let start = performance.now()
    runA()
    samplesA.push(performance.now() - start)

    start = performance.now()
    runB()
    samplesB.push(performance.now() - start)
  }

  const fastestA = min(samplesA)
  const fastestB = min(samplesB)
  console.log([
    scenario.name.padEnd(34),
    formatMs(fastestA).padStart(11),
    formatMs(fastestB).padStart(11),
    `${(fastestA / fastestB).toFixed(2)}x`.padStart(9),
    '  ',
    formatMs(median(samplesA)).padStart(10),
    formatMs(median(samplesB)).padStart(10),
  ].join(''))
}
