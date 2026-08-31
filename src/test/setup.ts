import '@testing-library/jest-dom/vitest'
import { webcrypto } from 'node:crypto'

Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
Object.defineProperty(window, 'scrollTo', { value: () => undefined })

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', { value: ResizeObserverMock })
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: () => null })
