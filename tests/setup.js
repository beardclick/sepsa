import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { webcrypto } from 'node:crypto'
Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
class MemoryStorage {
  values = new Map()
  getItem(key) {
    return this.values.get(String(key)) ?? null
  }
  setItem(key, value) {
    this.values.set(String(key), String(value))
  }
  removeItem(key) {
    this.values.delete(String(key))
  }
  clear() {
    this.values.clear()
  }
}
Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
})
Object.defineProperty(globalThis, 'sessionStorage', {
  value: new MemoryStorage(),
  configurable: true,
})
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
}
window.scrollTo = vi.fn()
window.matchMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})
