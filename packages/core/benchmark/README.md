# 基准测试

衡量 `@ikenxuan/qrcode` 在**真实下游用法**下的耗时，重点是二维码生成落在 React
渲染关键路径上时的代价（karin-plugin-kkk 的 ktr 渲染服务就是这么用的）。

## 为什么单独建一套基准

`test/` 里的用例断言的是**正确性**，它们会经过 vitest 转换；基准要量的是**性能**，
所以刻意绕开任何转换，用 Node 直接加载 `dist/`——也就是下游 `pnpm add` 之后
真正拿到的那份产物。改完源码要先 `pnpm build:core` 再跑基准，否则量到的还是旧产物。

## 类型检查

代价要说清楚：Node 的类型剥离**只删类型、不校验类型**，脚本里写错类型不会有任何反馈；
vitest 的转换同理，`tsdown` 生成的 `.d.ts` 也只覆盖 `src/` 入口。所以 `benchmark/`
和 `src/`、`test/` 一样纳入了 `tsconfig.json`，由这条命令兜底：

```bash
pnpm --filter @ikenxuan/qrcode typecheck   # tsc --noEmit，已挂在 build 末尾
```

脚本之间用的是 `./stats.ts` 这种**带后缀**的相对导入（Node 直接执行 `.ts` 的前提），
对应 tsconfig 里打开的 `allowImportingTsExtensions`——它只在 `noEmit` 下可用，
而本包本来就不靠 tsc 产出文件，所以没有额外代价。

## 运行

```bash
pnpm --filter @ikenxuan/qrcode bench              # 全部二维码生成场景
pnpm --filter @ikenxuan/qrcode bench:react        # React SSR 渲染场景
```

两个 npm 脚本都带了 `--expose-gc`；手动用 `node` 调用时别漏掉，否则场景之间不会
强制回收，样本会偏乐观（脚本检测到没有 gc 会打印提示）。

常用参数：

```bash
node --expose-gc benchmark/run.ts --iterations=7      # 提高迭代次数
node --expose-gc benchmark/run.ts --filter=logo       # 只跑名字含 logo 的场景
node --expose-gc benchmark/run.ts --json              # 机器可读输出，便于前后对比
```

## 对照两份产物

改构建参数（Cargo 优化等级、SIMD、LTO……）、升级 WASM 依赖，或者只是想确认某次改动
到底快了多少时，用这两个脚本：**先验一致性，再比快慢**——否则「变快了」可能只是少画了东西。

```bash
# 改动前留一份产物
cp -r dist /tmp/qrcode-dist-before

# 改动、重新构建后
node benchmark/compare-builds.ts /tmp/qrcode-dist-before/index.js dist/index.js
```

`compare-builds.ts` 逐字节比对九种典型配置（渐变、透明、Logo、各输出格式、超大尺寸）
的产物，并在结尾做一次生成→扫描回读；有任何一项不同就以非零码退出。

确认输出没变之后，再比耗时：

```bash
node --expose-gc benchmark/ab.ts /tmp/qrcode-dist-before/index.js dist/index.js
```

`ab.ts` 在**同一个进程里交替测量**两份产物（每轮 A 一次、B 一次），两边承受同样的
机器负载，再取各自最快的一次做对比。开发机上常有别的进程抢 CPU，两次独立运行的
`run.ts` 结果没法直接相减，这个脚本解决的就是这个问题。

还有体积这一头——改优化等级、开 SIMD 都会影响交付体积：

```bash
node benchmark/artifact-size.ts "已发布=<路径>/sync-xxxx.js" "本地=dist/sync-yyyy.js"
```

wasm 是 base64 内联进 JS 的，消费者下载的是那个 JS chunk 而且通常是**压缩后**的，
所以别看 `.wasm` 二进制多大就下结论：更小的二进制不必然对应更小的压缩体积。
`artifact-size.ts` 直接给原始 / gzip / brotli 三个口径。

## 场景设计

每个场景只改一个变量，把耗时归因到具体路径：

| 分组 | 场景 | 隔离的变量 |
| --- | --- | --- |
| 基线 | `baseline-png` / `baseline-svg` | 库的常规路径有多快 |
| 矢量 | `downstream-svg` | 矢量生成 vs 光栅化的成本分界 |
| 透明 | `downstream-nologo` / `downstream-nologo-opaque` | 透明背景是否触发了额外的 resvg 路径 |
| Logo | `downstream-logo-small` / `downstream-logo-large` / `...-noround` | Logo 解码、圆角裁剪的代价 |
| 编码 | `...-b64` / `...-png-b64` / `...-jpeg-b64` | base64 与各格式编码器的代价 |
| 尺寸 | `downstream-size500` / `-size2000` | 耗时随像素数如何增长 |

`downstream*` 系列逐字复刻下游 `ktr/utils/QRcode.ts` 的 `generateQRCode()` 参数
（size 1000、`extra-rounded`、透明背景、`webp` + `base64`）。

React 场景用 `renderToString` 渲染一棵结构对齐海报模板的树，对比「不含二维码 / 含二维码 /
含 Logo 二维码 / 二次渲染」。下游 `QRCodeWithAvatar` 在组件渲染体内**同步**调用
`generateQRCode()`，所以二维码生成直接压在 React 的关键路径上：

- ktr **开发预览**跑在浏览器里，命中 `QRCodeWithAvatarClient` 分支——先渲染一次无头像
  二维码，头像就位后再渲染一次，对应 `react-qr-client-double-render`。
- **Node SSR** 命中 `QRCodeWithAvatarServer` 分支，头像 await 完再渲染，对应
  `react-qr-*` 系列。

脚本用 `React.createElement` 而非 JSX，这样 Node 的类型剥离可以直接执行它，基准本身
不需要额外的构建步骤。

## 读结果

- **首次**：该场景第一次调用的耗时，含惰性初始化（WASM 实例化、分配器预热），
  更接近「首屏第一次渲染二维码」的体感。
- **最快 / 中位数 / p95**：稳定态下的样本分布。开发机上常有别的进程抢 CPU，
  **最快**那一列最接近无竞争时的真实开销，中位数与 p95 则更贴近日常体感；
  跑之前先关掉占 CPU 的程序，三者才会收敛。
- **产物**：返回值的字节数，用来观察编码体积。

`benchmark/fixtures.ts` 在运行时按固定种子生成 Logo 素材，不落盘二进制文件，
因此任何机器上跑出的都是同一张图，结果可复现、可比较。
