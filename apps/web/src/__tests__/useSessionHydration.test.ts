import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSessionHydration } from '@/hooks/studio/useSessionHydration';

const setAudioBuffer = vi.fn();
const setAudioBlob = vi.fn();
const setAudioDuration = vi.fn();
const setTranscript = vi.fn();
const loadPlayback = vi.fn();

let captureState = { audioBuffer: null as unknown, setAudioBuffer, setAudioBlob, setAudioDuration };

vi.mock('convex/react', () => ({
  useQuery: () => undefined,
}));

vi.mock('@Ordio/convex', () => ({
  api: { sessions: { getSession: 'sessions:getSession', getAudioUrl: 'sessions:getAudioUrl' } },
}));

vi.mock('@/stores', () => ({
  useCaptureStore: (selector?: (s: typeof captureState) => unknown) =>
    selector ? selector(captureState) : captureState,
  useProcessingStore: () => ({ setTranscript }),
}));

vi.mock('@/lib/media', () => ({
  decodeBlobToAudioBuffer: vi.fn(async () => ({ audioBuffer: { duration: 12 } })),
}));

global.fetch = vi.fn(async () => ({
  arrayBuffer: async () => new ArrayBuffer(8),
})) as unknown as typeof fetch;

describe('useSessionHydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captureState = { audioBuffer: null, setAudioBuffer, setAudioBlob, setAudioDuration };
  });

  it('does nothing when sessionId is null', () => {
    renderHook(() => useSessionHydration(null, { load: loadPlayback }));
    expect(setAudioBuffer).not.toHaveBeenCalled();
  });

  it('skips hydration when the store already has an audioBuffer', async () => {
    captureState = { audioBuffer: { duration: 5 }, setAudioBuffer, setAudioBlob, setAudioDuration };
    renderHook(() => useSessionHydration('s1', { load: loadPlayback }));
    await waitFor(() => expect(setAudioBuffer).not.toHaveBeenCalled());
  });
});
