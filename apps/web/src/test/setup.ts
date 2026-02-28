// Vitest + jsdom test environment setup
// Add global test polyfills or matchers here as the project grows

// ResizeObserver is used by @radix-ui/react-scroll-area but is not available in jsdom
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
