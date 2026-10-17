/** 计时统计工具：把原始样本换算成可读的分布指标。 */

export interface Summary {
  name: string
  n: number
  min: number
  median: number
  p95: number
  max: number
  mean: number
}

export const percentile = (sorted: number[], ratio: number): number => {
  if (sorted.length === 0) return Number.NaN
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(ratio * sorted.length) - 1))
  return sorted[index]
}

export const summarize = (name: string, samples: number[]): Summary => {
  const sorted = [...samples].sort((a, b) => a - b)
  const total = sorted.reduce((sum, value) => sum + value, 0)
  return {
    name,
    n: sorted.length,
    min: sorted[0],
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1],
    mean: total / sorted.length,
  }
}

export const formatMs = (value: number): string => {
  if (!Number.isFinite(value)) return 'n/a'
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`
  if (value >= 100) return `${value.toFixed(1)} ms`
  if (value >= 10) return `${value.toFixed(2)} ms`
  return `${value.toFixed(3)} ms`
}
