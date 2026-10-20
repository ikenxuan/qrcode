/**
 * @module @ikenxuan/qrcode/browser
 *
 * 浏览器兼容入口。该入口使用 Web Worker 调度 WASM 计算，
 * 适合在浏览器、React Client Component、Vue SFC 等客户端环境中调用。
 *
 * @packageDocumentation
 */
import { DotType, CornerSquareType, CornerDotType, ShapeType, OutputFormat, DyModuleStyle, DyFrameStyle, type QRCodeOptions, type DyCodeOptions, type Encoding, type GenerateResult, type Gradient, type DotsOptions, type CornersSquareOptions, type CornersDotOptions, type ImageOptions, type BackgroundOptions, type ScanDetails } from './types.js'

export { DotType, CornerSquareType, CornerDotType, ShapeType, OutputFormat, DyModuleStyle, DyFrameStyle }
export { generateSync, generateSvgSync, generateDySync, generateDySvgSync, scanSync, scanDetailedSync } from './sync.js'
export type { Gradient, DotsOptions, CornersSquareOptions, CornersDotOptions, ImageOptions, BackgroundOptions, QRCodeOptions, DyCodeOptions, Encoding, GenerateResult, ScanPoint, ScanCircle, ScanDetails } from './types.js'

type BrowserWorkerRequest =
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

interface BrowserWorkerResponse<T> {
  id: number
  ok: boolean
  value?: T
  error?: {
    message: string
    name?: string
    stack?: string
  }
}

interface BrowserWorkerReadyResponse {
  type: 'ready'
}

type BrowserWorkerMessage<T> = BrowserWorkerReadyResponse | BrowserWorkerResponse<T>

interface PendingRequest<T> {
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

class BrowserWorkerRuntimeError extends Error {
  readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'BrowserWorkerRuntimeError'
    this.cause = cause
  }
}

let browserWorker: Worker | null = null
let browserWorkerReady: Promise<void> | null = null
let nextRequestId = 0
const pendingRequests = new Map<number, PendingRequest<unknown>>()

const restoreWorkerError = (error: NonNullable<BrowserWorkerResponse<unknown>['error']>): Error => {
  const restored = new Error(error.message)
  if (error.name) restored.name = error.name
  if (error.stack) restored.stack = error.stack
  return restored
}

const rejectPendingRequests = (error: unknown): void => {
  for (const pending of pendingRequests.values()) {
    pending.reject(error)
  }
  pendingRequests.clear()
}

const getBrowserWorker = (): Worker => {
  if (browserWorker) return browserWorker

  browserWorker = new Worker(new URL('./browser-worker.js', import.meta.url), { type: 'module' })
  browserWorkerReady = new Promise<void>((resolve, reject) => {
    const worker = browserWorker as Worker

    const handleReady = (event: MessageEvent<BrowserWorkerMessage<unknown>>) => {
      if (!('type' in event.data) || event.data.type !== 'ready') return

      worker.removeEventListener('message', handleReady)
      worker.removeEventListener('error', handleReadyError)
      worker.removeEventListener('messageerror', handleReadyMessageError)
      resolve()
    }

    const handleReadyError = (event: ErrorEvent) => {
      worker.removeEventListener('message', handleReady)
      worker.removeEventListener('error', handleReadyError)
      worker.removeEventListener('messageerror', handleReadyMessageError)
      reject(
        new BrowserWorkerRuntimeError(
          event.message || 'QR code browser worker failed to start',
          event.error,
        ),
      )
    }

    const handleReadyMessageError = () => {
      worker.removeEventListener('message', handleReady)
      worker.removeEventListener('error', handleReadyError)
      worker.removeEventListener('messageerror', handleReadyMessageError)
      reject(new BrowserWorkerRuntimeError('QR code browser worker received an invalid message'))
    }

    worker.addEventListener('message', handleReady)
    worker.addEventListener('error', handleReadyError)
    worker.addEventListener('messageerror', handleReadyMessageError)
  })

  browserWorker.addEventListener('message', (event: MessageEvent<BrowserWorkerMessage<unknown>>) => {
    const response = event.data
    if (!('id' in response)) return

    const pending = pendingRequests.get(response.id)
    if (!pending) return

    pendingRequests.delete(response.id)

    if (response.ok) {
      pending.resolve(response.value)
    } else if (response.error) {
      pending.reject(restoreWorkerError(response.error))
    } else {
      pending.reject(new Error('QR code browser worker failed without an error message'))
    }
  })

  browserWorker.addEventListener('error', (event) => {
    rejectPendingRequests(
      new BrowserWorkerRuntimeError(
        event.message || 'QR code browser worker failed to start',
        event.error,
      ),
    )
    browserWorker?.terminate()
    browserWorker = null
    browserWorkerReady = null
  })

  browserWorker.addEventListener('messageerror', () => {
    rejectPendingRequests(
      new BrowserWorkerRuntimeError('QR code browser worker received an invalid message'),
    )
    browserWorker?.terminate()
    browserWorker = null
    browserWorkerReady = null
  })

  return browserWorker
}

const waitForBrowserWorker = async (): Promise<Worker> => {
  const worker = getBrowserWorker()
  await browserWorkerReady
  return worker
}

const runInBrowserWorker = async <T> (request: BrowserWorkerRequest): Promise<T> => {
  const postRequest = async (): Promise<T> => {
    const worker = await waitForBrowserWorker()

    return await new Promise<T>((resolve, reject) => {
      const id = nextRequestId++
      pendingRequests.set(id, {
        resolve: resolve as PendingRequest<unknown>['resolve'],
        reject,
      })

      try {
        worker.postMessage({ id, ...request })
      } catch (error) {
        pendingRequests.delete(id)
        reject(error)
      }
    })
  }

  try {
    return await postRequest()
  } catch (error) {
    if (!(error instanceof BrowserWorkerRuntimeError)) throw error

    await new Promise((resolve) => setTimeout(resolve, 50))
    return await postRequest()
  }
}

/**
 * 在浏览器中异步生成 QR 码。
 *
 * @remarks
 * 该函数会把内联 WASM 计算派发到浏览器 Web Worker 中执行，避免快速修改
 * 参数时阻塞 UI 主线程。
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
  return await runInBrowserWorker<GenerateResult<E>>({ method: 'generate', options, format, encoding })
}

/**
 * 在浏览器中异步生成 QR 码 SVG 字符串。
 *
 * @remarks
 * 在浏览器 Web Worker 中完成 SVG 渲染，返回值可以写入 DOM 或编码为
 * `data:image/svg+xml`。
 *
 * @param options - QR 码生成配置。
 * @returns Promise，resolve 后返回 SVG 字符串。
 */
export const generateSvg = async (options: QRCodeOptions): Promise<string> => {
  return await runInBrowserWorker<string>({ method: 'generateSvg', options })
}

/**
 * 在浏览器中异步生成抖音码。
 *
 * @remarks
 * 抖音码（`BEF_CODE_TYPE_DY_CODE`）是抖音平台下发的圆形码。默认参数
 * 复刻官方作品分享码版式：深色中心圆盘、四条数据环、三个定位圆环、
 * 外圈装饰弧和中心播放图标。编码与渲染在浏览器 Web Worker 中执行。
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
  return await runInBrowserWorker<GenerateResult<E>>({ method: 'generateDy', options, format, encoding })
}

/**
 * 在浏览器中异步生成抖音码 SVG 字符串。
 *
 * @param options - 抖音码生成配置。
 * @returns Promise，resolve 后返回 SVG 字符串。
 */
export const generateDySvg = async (options: DyCodeOptions): Promise<string> => {
  return await runInBrowserWorker<string>({ method: 'generateDySvg', options })
}

/**
 * 在浏览器中异步扫描图片中的 QR 码。
 *
 * @remarks
 * 传入 `Uint8Array` 图片数据，支持 PNG、JPEG、WebP。图片解码、预处理和
 * QR 解码会在浏览器 Web Worker 中执行。
 *
 * @param imageData - 图片文件的二进制数据。
 * @returns Promise，resolve 后返回 QR 码内容字符串，未识别到则返回 `null`。
 */
export const scan = async (imageData: Uint8Array): Promise<string | null> => {
  return await runInBrowserWorker<string | null>({ method: 'scan', imageData })
}

/**
 * 在浏览器中异步扫描图片中的二维码，并返回位置信息。
 *
 * @remarks
 * 与 {@link scan} 使用相同的解码流程，额外返回标准二维码的三个定位
 * 图案中心或抖音码的圆心/半径，坐标均为原图像素坐标。解码在浏览器
 * Web Worker 中执行。
 *
 * @param imageData - 图片文件的二进制数据。
 * @returns Promise，resolve 后返回文本与位置信息，未识别到则返回 `null`。
 */
export const scanDetailed = async (imageData: Uint8Array): Promise<ScanDetails | null> => {
  return await runInBrowserWorker<ScanDetails | null>({ method: 'scanDetailed', imageData })
}
