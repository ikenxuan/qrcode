/**
 * @module @ikenxuan/qrcode
 *
 * 基于 Rust qr-code-styling 库的高性能 QR 码生成器。
 * WASM 已内联，import 即用。
 *
 * @packageDocumentation
 */
import { Worker } from 'node:worker_threads'
import { DotType, CornerSquareType, CornerDotType, ShapeType, OutputFormat, DyModuleStyle, DyFrameStyle, type QRCodeOptions, type DyCodeOptions, type Encoding, type GenerateResult, type Gradient, type DotsOptions, type CornersSquareOptions, type CornersDotOptions, type ImageOptions, type BackgroundOptions, type ScanDetails } from './types.js'
import { generateSync, generateSvgSync, generateDySync, generateDySvgSync, scanSync, scanDetailedSync } from './sync.js'

export { DotType, CornerSquareType, CornerDotType, ShapeType, OutputFormat, DyModuleStyle, DyFrameStyle }
export { generateSync, generateSvgSync, generateDySync, generateDySvgSync, scanSync, scanDetailedSync }
export type { Gradient, DotsOptions, CornersSquareOptions, CornersDotOptions, ImageOptions, BackgroundOptions, QRCodeOptions, DyCodeOptions, Encoding, GenerateResult, ScanPoint, ScanCircle, ScanDetails } from './types.js'

type WorkerRequest =
  | {
    method: 'generate'
    options: QRCodeOptions
    format: OutputFormat
    encoding?: Encoding
  }
  | {
    method: 'generateSvg'
    options: QRCodeOptions
  }
  | {
    method: 'generateDy'
    options: DyCodeOptions
    format: OutputFormat
    encoding?: Encoding
  }
  | {
    method: 'generateDySvg'
    options: DyCodeOptions
  }
  | {
    method: 'scan'
    imageData: Uint8Array
  }
  | {
    method: 'scanDetailed'
    imageData: Uint8Array
  }

interface WorkerResponse<T> {
  ok: boolean
  value?: T
  error?: {
    message: string
    name?: string
    stack?: string
  }
}

const restoreWorkerError = (error: NonNullable<WorkerResponse<unknown>['error']>): Error => {
  const restored = new Error(error.message)
  if (error.name) restored.name = error.name
  if (error.stack) restored.stack = error.stack
  return restored
}

const runInWorker = async <T> (request: WorkerRequest): Promise<T> => {
  return await new Promise<T>((resolve, reject) => {
    const worker = new Worker(new URL('./worker.js', import.meta.url))
    let settled = false

    worker.once('message', (response: WorkerResponse<T>) => {
      settled = true
      void worker.terminate()

      if (response.ok) {
        resolve(response.value as T)
      } else if (response.error) {
        reject(restoreWorkerError(response.error))
      } else {
        reject(new Error('QR code worker failed without an error message'))
      }
    })

    worker.once('error', (error: Error) => {
      if (settled) return
      settled = true
      reject(error)
    })

    worker.once('exit', (code: number) => {
      if (settled || code === 0) return
      settled = true
      reject(new Error(`QR code worker stopped with exit code ${code}`))
    })

    worker.postMessage(request)
  })
}

/**
 * 异步生成 QR 码。
 *
 * @remarks
 * 在 Node.js 中，该函数会把同步 WASM 计算派发到 `worker_threads`
 * 中执行，避免阻塞主线程事件循环。浏览器或客户端组件请改用
 * `@ikenxuan/qrcode/browser` 入口，或显式调用同步 API。
 *
 * @example
 * ```ts
 * import { generate } from '@ikenxuan/qrcode'
 *
 * const png = await generate({ data: 'https://example.com' }, 'png')
 * ```
 *
 * @param options - QR 码生成配置。
 * @param format - 输出格式，支持 `'svg'`、`'png'`、`'jpeg'`、`'webp'`。
 * @param encoding - 编码方式，默认 `'binary'`。
 * @returns Promise，resolve 后根据 encoding 返回 `Uint8Array`（binary）或 base64 `string`。
 */
export const generate = async <E extends Encoding = 'binary'> (
  options: QRCodeOptions,
  format: OutputFormat,
  encoding?: E,
): Promise<GenerateResult<E>> => {
  return await runInWorker<GenerateResult<E>>({ method: 'generate', options, format, encoding })
}

/**
 * 异步生成 QR 码 SVG 字符串。
 *
 * @remarks
 * 在 Node.js 中通过 worker 线程调用 WASM SVG 渲染。浏览器端请从
 * `@ikenxuan/qrcode/browser` 导入同名方法或使用 `generateSvgSync`。
 *
 * @example
 * ```ts
 * import { generateSvg } from '@ikenxuan/qrcode'
 *
 * const svg = await generateSvg({ data: 'https://example.com' })
 * ```
 *
 * @param options - QR 码生成配置。
 * @returns Promise，resolve 后返回 SVG 字符串。
 */
export const generateSvg = async (options: QRCodeOptions): Promise<string> => {
  return await runInWorker<string>({ method: 'generateSvg', options })
}

/**
 * 异步生成抖音码。
 *
 * @remarks
 * 抖音码（`BEF_CODE_TYPE_DY_CODE`）是抖音平台下发的圆形码。默认参数
 * 复刻官方作品分享码版式：深色中心圆盘、四条数据环、三个定位圆环、
 * 外圈装饰弧和中心播放图标。默认布局最多容纳 38 字节 UTF-8 文本。
 *
 * 在 Node.js 中通过 worker 线程执行 WASM 编码与渲染，避免阻塞主线程。
 *
 * @example
 * ```ts
 * import { generateDy } from '@ikenxuan/qrcode'
 *
 * const png = await generateDy({ data: 'https://v.douyin.com/utbKgTJRmlI/' }, 'png')
 * const svg = await generateDySvg({ data: 'https://v.douyin.com/utbKgTJRmlI/' })
 * ```
 *
 * @param options - 抖音码生成配置。
 * @param format - 输出格式，支持 `'png'`、`'jpeg'`、`'webp'`、`'svg'`，默认 `'png'`。
 * @param encoding - 编码方式，默认 `'binary'`。
 * @returns Promise，resolve 后根据 encoding 返回 `Uint8Array`（binary）或 base64 `string`。
 */
export const generateDy = async <E extends Encoding = 'binary'> (
  options: DyCodeOptions,
  format: OutputFormat = 'png',
  encoding?: E,
): Promise<GenerateResult<E>> => {
  return await runInWorker<GenerateResult<E>>({ method: 'generateDy', options, format, encoding })
}

/**
 * 异步生成抖音码 SVG 字符串。
 *
 * @param options - 抖音码生成配置。
 * @returns Promise，resolve 后返回 SVG 字符串。
 */
export const generateDySvg = async (options: DyCodeOptions): Promise<string> => {
  return await runInWorker<string>({ method: 'generateDySvg', options })
}

/**
 * 异步扫描图片中的 QR 码。
 *
 * @remarks
 * 支持 PNG、JPEG、WebP 格式图片数据。在 Node.js 中通过 worker 线程执行
 * 图片解码、预处理和 QR 解码，适合服务端批量识别或避免阻塞请求处理。
 *
 * @example
 * ```ts
 * import { readFile } from 'node:fs/promises'
 * import { scan } from '@ikenxuan/qrcode'
 *
 * const image = await readFile('qrcode.png')
 * const text = await scan(image)
 * ```
 *
 * @param imageData - 图片文件的二进制数据。
 * @returns Promise，resolve 后返回 QR 码内容字符串，未识别到则返回 `null`。
 */
export const scan = async (imageData: Uint8Array): Promise<string | null> => {
  return await runInWorker<string | null>({ method: 'scan', imageData })
}

/**
 * 异步扫描图片中的二维码，并返回位置信息。
 *
 * @remarks
 * 与 {@link scan} 使用相同的解码流程，额外返回标准二维码的三个定位
 * 图案中心或抖音码的圆心/半径，坐标均为原图像素坐标。在 Node.js 中
 * 通过 worker 线程执行。
 *
 * @example
 * ```ts
 * import { readFile } from 'node:fs/promises'
 * import { scanDetailed } from '@ikenxuan/qrcode'
 *
 * const image = await readFile('qrcode.png')
 * const result = await scanDetailed(image)
 * console.log(result?.text, result?.points)
 * ```
 *
 * @param imageData - 图片文件的二进制数据。
 * @returns Promise，resolve 后返回文本与位置信息，未识别到则返回 `null`。
 */
export const scanDetailed = async (imageData: Uint8Array): Promise<ScanDetails | null> => {
  return await runInWorker<ScanDetails | null>({ method: 'scanDetailed', imageData })
}
