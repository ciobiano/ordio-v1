import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSessionHydration } from '@/hooks/session/useSessionHydration';

const setAudioBuffer = vi.fn();
const setAudioBlob = vi.fn();
const setAudioDuration = vi.fn();
const setTranscript = vi.fn();
const loadPlayback = vi.fn();

let captureState = { audioBuffer: null as unknown, setAudioBuffer, setAudioBlob, setAudioDuration };

type SessionDoc = { mimeType: string; transcript: unknown[] };
let sessionsById: Record<string, SessionDoc> = {};
let audioUrlsById: Record<string, string> = {};

vi.mock('convex/react', () => ({
  useQuery: (queryRef: string, args: 'skip' | { sessionId: string }) => {
    if (args === 'skip') return undefined;
    if (queryRef === 'sessions:getSession') return sessionsById[args.sessionId];
    if (queryRef === 'sessions:getAudioUrl') return audioUrlsById[args.sessionId];
    return undefined;
  },
}));

vi.mock('@Ordio/convex', () => ({
  api: { sessions: { getSession: 'sessions:getSession', getAudioUrl: 'sessions:getAudioUrl' } },
}));

vi.mock('@/stores', () => ({
  useCaptureStore: (selector?: (s: typeof captureState) => unknown) =>
    selector ? selector(captureState) : captureState,
  useProcessingStore: (selector?: (s: { setTranscript: typeof setTranscript }) => unknown) => {
    const state = { setTranscript };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@Ordio/engine/media', () => ({
  // Reports back which session's mimeType it decoded, so a test can tell
  // whether a stale (superseded) decode result reached the store.
  decodeBlobToAudioBuffer: vi.fn(async (blob: Blob) => ({
    audioBuffer: { duration: 12, mimeType: blob.type },
  })),
}));

// Per-URL controllable promises so a test can decide which fetch resolves
// first, independent of the order the hook issued them in.
const fetchResolvers: Record<string, (value: unknown) => void> = {};
global.fetch = vi.fn((url: string) => {
  return new Promise((resolve) => {
    fetchResolvers[url] = () =>
      resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as unknown as Response);
  });
}) as unknown as typeof fetch;

describe('useSessionHydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captureState = { audioBuffer: null, setAudioBuffer, setAudioBlob, setAudioDuration };
    sessionsById = {};
    audioUrlsById = {};
    for (const key of Object.keys(fetchResolvers)) delete fetchResolvers[key];
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

  it('discards a stale hydration when the session was switched while it was in flight', async () => {
    sessionsById.a = { mimeType: 'audio/a', transcript: ['A'] };
    sessionsById.b = { mimeType: 'audio/b', transcript: ['B'] };
    audioUrlsById.a = 'https://storage/a';
    audioUrlsById.b = 'https://storage/b';

    const { rerender } = renderHook(
      ({ sessionId }) => useSessionHydration(sessionId, { load: loadPlayback }),
      { initialProps: { sessionId: 'a' } }
    );

    // Session A's fetch is now in flight (unresolved). Switch to session B
    // before it settles -- mirrors clicking clip B while A is still loading.
    await waitFor(() => expect(fetchResolvers['https://storage/a']).toBeDefined());
    rerender({ sessionId: 'b' });

    // A's fetch resolves after the switch. Its result must be discarded --
    // not written into the store as if it were still the open session.
    fetchResolvers['https://storage/a']!({});
    await waitFor(() => expect(fetchResolvers['https://storage/b']).toBeDefined());
    expect(setAudioBuffer).not.toHaveBeenCalled();
    expect(setTranscript).not.toHaveBeenCalled();

    // B's own fetch -- which only starts once A's in-flight request clears
    // isHydrating -- now completes and is the only thing that reaches the store.
    fetchResolvers['https://storage/b']!({});
    await waitFor(() =>
      expect(setAudioBuffer).toHaveBeenCalledWith(expect.objectContaining({ mimeType: 'audio/b' }))
    );
    expect(setTranscript).toHaveBeenCalledWith(['B']);
    expect(setAudioBuffer).toHaveBeenCalledTimes(1);
    expect(setTranscript).toHaveBeenCalledTimes(1);
  });
});
