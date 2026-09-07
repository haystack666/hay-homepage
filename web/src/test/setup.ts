import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

class MockIntersectionObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds: readonly number[] = []

  disconnect() {}

  observe() {}

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }

  unobserve() {}
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
