import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts', '__tests__/integration/**/*.test.ts'],
    globals: true,
    setupFiles: ['__tests__/setup.ts'],
    passWithNoTests: true,
  },
})
