/** 两个基准脚本共用的采样循环与输出格式。 */
import { performance } from 'node:perf_hooks'
import { summarize, formatMs, type Summary } from './stats.ts'

export interface BenchEntry {
  name: string
  /** 人类可读的假设，说明这个场景在验证什么。 */
  probes: string
  /** 执行一次被测操作，返回产物字节数（用于顺带记录输出体积）。 */
  run: () => number
}

export interface BenchResult {
  name: string
  probes: string
  summary: Summary
  /** 首次调用耗时，含惰性初始化（WASM 实例化、分配器预热）。 */
  coldMs: number
  outputBytes: number
}

export const gcIfAvailable = (warn: () => void): void => {
  if (typeof global.gc === 'function') global.gc()
  else warn()
}

export const runBenchmark = (
  entries: BenchEntry[],
  iterations: number,
  asJson: boolean,
  beforeEachScenario?: () => void,
): BenchResult[] => {
  const results: BenchResult[] = []

  for (const entry of entries) {
    beforeEachScenario?.()
    const samples: number[] = []
    let coldMs = Number.NaN
    let outputBytes = 0

    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      outputBytes = entry.run()
      const elapsed = performance.now() - start
      if (i === 0) coldMs = elapsed
      else samples.push(elapsed)
    }

    results.push({
      name: entry.name,
      probes: entry.probes,
      // 迭代只有 1 次时没有独立样本，退回首次耗时
      summary: summarize(entry.name, samples.length > 0 ? samples : [coldMs]),
      coldMs,
      outputBytes,
    })
  }

  if (asJson) {
    console.log(JSON.stringify(results, null, 2))
    return results
  }

  const nameWidth = Math.max(...results.map((result) => result.name.length), 8)
  // 开发机常被别的进程占着 CPU，中位数会明显上浮；最小的样本最接近无竞争时的真实开销。
  const header = [
    '场景'.padEnd(nameWidth),
    '首次'.padStart(10),
    '最快'.padStart(10),
    '中位数'.padStart(10),
    'p95'.padStart(10),
    '产物'.padStart(10),
  ].join('  ')
  console.log(header)
  console.log('-'.repeat(header.length))

  for (const result of results) {
    console.log([
      result.name.padEnd(nameWidth),
      formatMs(result.coldMs).padStart(10),
      formatMs(result.summary.min).padStart(10),
      formatMs(result.summary.median).padStart(10),
      formatMs(result.summary.p95).padStart(10),
      `${(result.outputBytes / 1024).toFixed(1)} KB`.padStart(10),
    ].join('  '))
    console.log(`${''.padEnd(nameWidth)}  └ ${result.probes}`)
  }

  const slowest = [...results].sort((a, b) => b.summary.min - a.summary.min)[0]
  console.log(`\n最慢场景：${slowest.name} → 最快一次 ${formatMs(slowest.summary.min)}`)
  return results
}

export const argOf = (name: string): string | undefined => {
  const prefix = `--${name}=`
  const hit = process.argv.find((arg) => arg.startsWith(prefix))
  return hit?.slice(prefix.length)
}

export const hasFlag = (name: string): boolean => process.argv.includes(`--${name}`)
