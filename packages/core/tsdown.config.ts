import { defineConfig, type UserConfig } from 'tsdown'
import { wasm } from 'rolldown-plugin-wasm'

const commonConfig: UserConfig = {
  outDir: 'dist',
  format: 'esm',
  dts: true,
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  plugins: [
    wasm({
      maxFileSize: 10 * 1024 * 1024,
      targetEnv: 'auto-inline',
    }),
  ],
  deps: {
    alwaysBundle: [/@ikenxuan\/qrcode-wasm/],
  },
}

export default defineConfig([
  {
    ...commonConfig,
    entry: [
      // Public Node.js package entry.
      'src/index.ts',

      // Runtime worker file loaded by src/index.ts.
      'src/worker.ts',
    ],
    platform: 'node',
    clean: true,
  },
  {
    ...commonConfig,
    entry: [
      // Public browser package entry.
      'src/browser.ts',

      // Runtime worker file loaded by src/browser.ts.
      'src/browser-worker.ts',
    ],
    platform: 'browser',
    clean: false,
  },
])
