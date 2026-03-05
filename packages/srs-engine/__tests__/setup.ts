import { afterEach, vi } from 'vitest'

// Reset fake timers after each test to prevent bleed
afterEach(() => {
  vi.useRealTimers()
})
