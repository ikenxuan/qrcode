import { generateSync, generateSvgSync, scanSync } from './sync.js'
import type { Encoding, OutputFormat, QRCodeOptions } from './types.js'

type BrowserWorkerRequest =
  | {
    id: number
    method: 'generate'
    options: QRCodeOptions
    format: OutputFormat
    encoding?: Encoding
  }
  | {
    id: number
    method: 'generateSvg'
    options: QRCodeOptions
  }
  | {
    id: number
    method: 'scan'
    imageData: Uint8Array
  }

interface BrowserWorkerReadyResponse {
  type: 'ready'
}

interface SerializedError {
  message: string
  name?: string
  stack?: string
}

const workerScope = globalThis as unknown as {
  postMessage: (message: unknown, transfer?: Transferable[]) => void
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<BrowserWorkerRequest>) => void,
  ) => void
}

const serializeError = (error: unknown): SerializedError => {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    }
  }
  return { message: String(error) }
}

const postSuccess = (id: number, value: unknown): void => {
  if (value instanceof Uint8Array) {
    workerScope.postMessage({ id, ok: true, value }, [value.buffer])
    return
  }

  workerScope.postMessage({ id, ok: true, value })
}

workerScope.addEventListener('message', (event) => {
  const request = event.data

  try {
    switch (request.method) {
      case 'generate':
        postSuccess(
          request.id,
          generateSync(request.options, request.format, request.encoding),
        )
        break
      case 'generateSvg':
        postSuccess(request.id, generateSvgSync(request.options))
        break
      case 'scan':
        postSuccess(request.id, scanSync(request.imageData))
        break
    }
  } catch (error) {
    workerScope.postMessage({
      id: request.id,
      ok: false,
      error: serializeError(error),
    })
  }
})

workerScope.postMessage({ type: 'ready' } satisfies BrowserWorkerReadyResponse)
