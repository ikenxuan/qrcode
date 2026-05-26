import { defineConfig } from 'tsdown'
import { wasm } from 'rolldown-plugin-wasm'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: 'esm',
  dts: true,
  platform: 'node',
  clean: true,
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
})
