/**
 * React 渲染基准：复刻 karin-plugin-kkk 的 ktr 渲染服务形态。
 *
 * 下游的 `QRCodeWithAvatar` 在**组件渲染体内同步调用** `generateQRCode()`，
 * 所以二维码生成完全落在 React 渲染的关键路径上。这里用 `renderToString`
 * 测量整棵树，分别跑「不带二维码 / 带二维码 / 带 Logo 二维码 / 二次渲染」。
 *
 * 关于「二次渲染」：ktr 开发预览跑在浏览器里（sandbox 用 `createRoot` 渲染，
 * 命中 `QRCodeWithAvatarClient` 分支），头像没就位时先渲染一次无头像二维码，
 * `loadQRCodeAvatar()` resolve 后 `setAvatar` 再渲染一次——同一个二维码生成两遍。
 * Node 端的 SSR 走 `QRCodeWithAvatarServer` 分支，只渲染一次，对应下面
 * `react-qr-*` 系列场景。
 *
 * 用 `React.createElement` 而不是 JSX，是为了让脚本能被 Node 直接执行
 * （Node 的类型剥离只删类型，不转换 JSX），基准脚本因此不需要额外的构建步骤。
 *
 *   node --expose-gc benchmark/react-ssr.ts
 *   node --expose-gc benchmark/react-ssr.ts --iterations=7
 */
import { performance } from 'node:perf_hooks'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { formatMs } from './stats.ts'
import { smallLogo, largeLogo } from './fixtures.ts'
import { downstreamOptions } from './scenarios.ts'
import { argOf, gcIfAvailable, hasFlag, runBenchmark, type BenchEntry } from './harness.ts'

const iterations = Number(argOf('iterations') ?? 5)
const asJson = hasFlag('json')
const h = React.createElement

const importStart = performance.now()
const { generateSync } = await import('../dist/index.js')
const importMs = performance.now() - importStart

const SHARE_URL = 'https://www.xiaohongshu.com/user/profile/5f3b1c0e000000000100abcd?xsec_token=AB1cdEF2gh'
const small = smallLogo()
const large = largeLogo()

/** 与下游 `ktr/utils/QRcode.ts` 的 generateQRCode 保持一致。 */
const generateQRCode = (text: string, useDarkTheme: boolean, image?: Uint8Array): string => {
  const color = useDarkTheme ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)'
  const base64 = generateSync(
    {
      ...downstreamOptions(image),
      data: text,
      dotsOptions: { dotType: 'extra-rounded', color },
      cornersSquareOptions: { cornerType: 'dot', color },
      cornersDotOptions: { cornerType: 'dot', color },
    },
    'webp',
    'base64',
  )
  return `data:image/webp;base64,${base64}`
}

/** 下游 QRCodeWithAvatar 的渲染体：二维码在 render 期间同步生成。 */
const QRCodeImage = (props: { value: string; useDarkTheme: boolean; avatar?: Uint8Array }) =>
  h('img', {
    src: generateQRCode(props.value, props.useDarkTheme, props.avatar),
    alt: '二维码',
    className: 'w-full h-full object-contain',
  })

/** 海报骨架，结构对齐 ktr 的小红书登录二维码模板（省略纯装饰节点）。 */
const Poster = (props: { children?: React.ReactNode }) =>
  h(
    'div',
    { className: 'relative overflow-hidden', style: { background: '#FFFFFF', color: '#000000' } },
    h(
      'div',
      { className: 'relative z-10 flex flex-col items-center justify-center h-full py-40 px-24' },
      h(
        'div',
        { className: 'text-center' },
        h('h1', { className: 'text-8xl font-bold' }, '小红书扫码登录'),
        h(
          'div',
          { className: 'flex items-start justify-center gap-10' },
          ...['打开小红书', '右下角「我」', '顶部扫一扫'].map((label) =>
            h('div', { key: label, className: 'flex flex-col items-center gap-4' }, h('span', null, label)),
          ),
        ),
      ),
      h('div', { className: 'relative p-4', style: { width: '800px', height: '800px' } }, props.children),
      h(
        'div',
        { className: 'w-full max-w-4xl pt-20' },
        h('h3', null, '安全承诺'),
        h(
          'p',
          null,
          '扫码只会把小红书网页端的登录凭证（ck）保存在本机配置里，用于请求小红书官方接口；不会上传到任何第三方。',
        ),
      ),
    ),
  )

const renderPoster = (qr?: React.ReactNode): number =>
  renderToString(h(Poster, null, qr)).length

const entries: BenchEntry[] = [
  {
    name: 'react-only',
    probes: '整棵海报树但不含二维码，衡量 React 自身的渲染开销',
    run: () => renderPoster(),
  },
  {
    name: 'react-qr-no-logo',
    probes: '海报 + 无 Logo 二维码（size 1000 / webp / base64）',
    run: () => renderPoster(h(QRCodeImage, { value: SHARE_URL, useDarkTheme: false })),
  },
  {
    name: 'react-qr-small-logo',
    probes: '海报 + 128px Logo 二维码，即下游开发预览的实际形态',
    run: () => renderPoster(h(QRCodeImage, { value: SHARE_URL, useDarkTheme: false, avatar: small })),
  },
  {
    name: 'react-qr-large-logo',
    probes: '海报 + 512px Logo 二维码，验证 Logo 尺寸对整树渲染的影响',
    run: () => renderPoster(h(QRCodeImage, { value: SHARE_URL, useDarkTheme: false, avatar: large })),
  },
  {
    name: 'react-qr-client-double-render',
    probes: 'ktr 开发预览的真实形态：浏览器分支先渲染无头像二维码，头像就位后再渲染一次',
    run: () => {
      renderPoster(h(QRCodeImage, { value: SHARE_URL, useDarkTheme: false }))
      return renderPoster(h(QRCodeImage, { value: SHARE_URL, useDarkTheme: false, avatar: small }))
    },
  },
]

console.log(`\n模块加载（dist/index.js + 内联 WASM）：${formatMs(importMs)}`)
console.log(`迭代次数：${iterations}\n`)

let warned = false
runBenchmark(entries, iterations, asJson, () => {
  gcIfAvailable(() => {
    if (warned) return
    warned = true
    console.warn('提示：未开启 --expose-gc，场景之间不会强制回收，样本可能偏乐观。\n')
  })
})
