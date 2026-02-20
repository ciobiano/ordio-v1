import { vi } from 'vitest';

// Global test setup for jsdom environment

// Stub out browser APIs that jsdom doesn't provide
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
    close: vi.fn(),
    currentTime: 0,
    destination: {},
    state: 'running',
  })),
});

Object.defineProperty(window, 'MediaRecorder', {
  writable: true,
  value: Object.assign(
    vi.fn().mockImplementation(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      ondataavailable: null,
      onstop: null,
      state: 'inactive',
    })),
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
