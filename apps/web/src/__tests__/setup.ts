import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Expose `jest` as a global alias for `vi` so tests written with Jest syntax work under Vitest
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).jest = vi;

// Global test setup for jsdom environment

// Stub out browser APIs that jsdom doesn't provide
Object.defineProperty(globalThis, 'AudioBuffer', {
  writable: true,
  value: class AudioBuffer {
    private _channelData: Float32Array[] = [];
    constructor(options: { length: number; numberOfChannels: number; sampleRate: number }) {
      this._length = options.length;
      this._numberOfChannels = options.numberOfChannels;
      this._sampleRate = options.sampleRate;
      this._channelData = Array.from(
        { length: options.numberOfChannels },
        () => new Float32Array(options.length)
      );
    }
    get length() {
      return this._length;
    }
    set length(v: number) {
      this._length = v;
    }
    get numberOfChannels() {
      return this._numberOfChannels;
    }
    set numberOfChannels(v: number) {
      this._numberOfChannels = v;
    }
    get sampleRate() {
      return this._sampleRate;
    }
    set sampleRate(v: number) {
      this._sampleRate = v;
    }
    private _length = 0;
    private _numberOfChannels = 0;
    private _sampleRate = 0;
    get duration() {
      return this._length / this._sampleRate;
    }
    getChannelData(channel: number) {
      return this._channelData[channel] ?? new Float32Array(this._length);
    }
    copyToChannel(source: Float32Array, channelNumber: number, bufferOffset = 0) {
      this._channelData[channelNumber]?.set(source, bufferOffset);
    }
  },
});

Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    createBufferSource: vi.fn().mockReturnValue({
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      buffer: null,
      onended: null,
    }),
    createMediaStreamDestination: vi.fn().mockReturnValue({
      stream: { getAudioTracks: vi.fn().mockReturnValue([]) },
    }),
    createBuffer: (numberOfChannels: number, length: number, sampleRate: number) =>
      new AudioBuffer({ length, numberOfChannels, sampleRate }),
    close: vi.fn(),
    currentTime: 0,
    destination: {},
    state: 'running',
  })),
});

Object.defineProperty(window, 'MediaRecorder', {
  writable: true,
  value: Object.assign(
    // Uses a real `function`, not an arrow function, so `new MediaRecorder()`
    // behaves reliably under `vi.useFakeTimers()` — see:
    // https://vitest.dev/api/vi#vi-spyon
    vi.fn().mockImplementation(function MockMediaRecorder() {
      return {
        start: vi.fn(),
        stop: vi.fn(),
        ondataavailable: null,
        onstop: null,
        state: 'inactive',
      };
    }),
    {
      isTypeSupported: vi.fn().mockReturnValue(false),
    }
  ),
});

Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  configurable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: vi.fn().mockReturnValue([]),
    }),
  },
});

// Mock ResizeObserver (not available in jsdom)
if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as Record<string, unknown>).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Mock scrollIntoView (jsdom has no layout, so it ships no implementation at
// all — calling it throws rather than no-opping). Scrolling strips use it to
// keep the active item on screen.
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

// Mock OffscreenCanvas for drawGraphic tests (not available in jsdom)
if (typeof globalThis.OffscreenCanvas === 'undefined') {
  (globalThis as Record<string, unknown>).OffscreenCanvas = class {
    constructor(
      public width: number,
      public height: number
    ) {}
    getContext() {
      const calls: Array<{ method: string; args: unknown[] }> = [];
      return new Proxy({} as Record<string, unknown>, {
        get: (_t, p: string) => {
          if (p === '__calls') return calls;
          return (...a: unknown[]) => calls.push({ method: String(p), args: a });
        },
        set: (_t, p: string, v: unknown) => {
          calls.push({ method: `set:${String(p)}`, args: [v] });
          return true;
        },
      });
    }
  };
}

// vaul (OrdSheet) animates its exit with a CSS keyframe and Radix unmounts it
// on `animationend`, which jsdom never fires — a closed sheet would stay in the
// DOM forever. Tests assert on open/closed, not on the slide, so report no
// animation for vaul's own nodes.
const realGetComputedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = ((element: Element, pseudo?: string | null) => {
  const style = realGetComputedStyle(element, pseudo);
  if (!element.hasAttribute('data-vaul-drawer') && !element.hasAttribute('data-vaul-overlay')) return style;
  return new Proxy(style, {
    get(target, prop) {
      if (prop === 'animationName') return 'none';
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}) as typeof window.getComputedStyle;
