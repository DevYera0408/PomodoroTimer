import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Separate config: vitest.config.ts takes priority over vite.config.ts for `vitest`,
// so the build/dev config stays untouched.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Date is faked too (stable dateKey), but not queueMicrotask/performance —
    // React's act() flushing relies on them.
    fakeTimers: {
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    },
  },
})
