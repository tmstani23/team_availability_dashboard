// defineConfig comes from 'vitest/config' rather than 'vite' - same function,
// but it's the one that knows about the `test` key below. Importing it from
// 'vite' type-errors on that key.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom is a fake DOM implemented in JavaScript - it gives components a
    // document to render into inside Node, with no browser involved. It has no
    // rendering ENGINE, so layout, the sticky name column and the base-select
    // popup all stay manual QA; what it buys is everything that happens before
    // pixels: which elements exist, what they say, and what a click does.
    //
    // Applied to EVERY test file rather than just the component ones. The pure
    // util suites don't need a DOM, but Vitest 4 removed the per-glob
    // environment option, and splitting the run into two projects to save them
    // an unused `document` isn't worth the config - dayjs and Intl behave
    // identically either way.
    environment: 'jsdom',
    // Two jobs, and neither is optional here - see the file itself.
    setupFiles: ['./src/test/setup.ts'],
  },
})
