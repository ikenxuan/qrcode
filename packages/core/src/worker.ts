import { parentPort } from 'node:worker_threads'
import { generateSync, generateSvgSync, scanSync } from './sync.js'
import type { Encoding, OutputFormat, QRCodeOptions } from './types.js'

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
    method: 'scan'
    imageData: Uint8Array
  }

interface SerializedError {
  message: string
  name?: string
  stack?: string
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

parentPort?.on('message', (request: WorkerRequest) => {
  try {
    switch (request.method) {
      case 'generate':
        parentPort?.postMessage({
          ok: true,
          value: generateSync(request.options, request.format, request.encoding),
        })
        break
      case 'generateSvg':
        parentPort?.postMessage({
          ok: true,
          value: generateSvgSync(request.options),
        })
        break
      case 'scan':
        parentPort?.postMessage({
          ok: true,
          value: scanSync(request.imageData),
        })
        break
    }
  } catch (error) {
    parentPort?.postMessage({
      ok: false,
      error: serializeError(error),
    })
  }
})
