import '@testing-library/jest-dom/vitest'

// jsdom has no Web Audio; App.playBeep() caches one module-level context.
class FakeAudioContext {
  state = 'running'
  currentTime = 0
  destination = {}
  resume = () => Promise.resolve()
  createOscillator = () => ({
    frequency: { value: 0 },
    connect: () => {},
    start: () => {},
    stop: () => {},
  })
  createGain = () => ({
    gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    connect: () => {},
  })
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    writable: true,
    value: FakeAudioContext,
  })
}
