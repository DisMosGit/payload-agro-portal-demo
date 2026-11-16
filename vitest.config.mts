import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    // Every suite boots Payload, and the Postgres adapter pushes the dev schema
    // on boot. Parallel files race on the same DDL, so run files one at a time.
    fileParallelism: false,
  },
})
