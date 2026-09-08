import * as matchers from '@testing-library/jest-dom/matchers'
import { webcrypto } from 'node:crypto'

expect.extend(matchers)

Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
Object.defineProperty(window, 'scrollTo', { value: () => undefined })

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', { value: ResizeObserverMock })
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: () => null })
