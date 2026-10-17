/**
 * `@ikenxuan/qrcode` 基准测试入口。
 *
 * 刻意只加载 `dist/` 构建产物（和 test/ 里的用法一致），不经过 ts 源码或
 * vitest 转换，这样量到的就是下游安装 npm 包后拿到的那份代码。
 *
 *   node --expose-gc benchmark/run.ts                  # 跑全部场景
 *   node --expose-gc benchmark/run.ts --iterations=7   # 指定每场景迭代次数
 *   node --expose-gc benchmark/run.ts --filter=logo    # 只跑名字含 logo 的场景
 *   node --expose-gc benchmark/run.ts --json           # 输出机器可读结果
 */
import { performance } from 'node:perf_hooks'
import { formatMs } from './stats.ts'
import { smallLogo, largeLogo } from './fixtures.ts'
import { buildScenarios } from './scenarios.ts'
import { argOf, gcIfAvailable, hasFlag, runBenchmark, type BenchEntry } from './harness.ts'

const iterations = Number(argOf('iterations') ?? 5)
const filter = argOf('filter')
const asJson = hasFlag('json')

const importStart = performance.now()
const api = await import('../dist/index.js')
const importMs = performance.now() - importStart

const small = smallLogo()
const large = largeLogo()

const scenarios = buildScenarios(small, large)
  .filter((scenario) => !filter || scenario.name.includes(filter))

if (scenarios.length === 0) {
  console.error(`没有匹配 --filter=${filter} 的场景`)
  process.exit(1)
}

console.log(`\n模块加载（dist/index.js + 内联 WASM）：${formatMs(importMs)}`)
if (importMs > 100) {
  console.log('  ↑ 冷启动开销：首次 import 需要解析内联 WASM，会叠加到首个二维码渲染上。')
}
console.log(`迭代次数：${iterations}\n`)

const entries: BenchEntry[] = scenarios.map((scenario) => ({
  name: scenario.name,
  probes: scenario.probes,
  run: () => {
    const output = api.generateSync(scenario.options, scenario.format, scenario.encoding)
    return typeof output === 'string' ? output.length : output.byteLength
  },
}))

let warned = false
runBenchmark(entries, iterations, asJson, () => {
  gcIfAvailable(() => {
    if (warned) return
    warned = true
    console.warn('提示：未开启 --expose-gc，场景之间不会强制回收，样本可能偏乐观。\n')
  })
})
