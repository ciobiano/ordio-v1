import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ChangeEvent } from 'react';
import { EPISODE_ROUTE_THRESHOLD_SEC } from '@/lib/media/episodePlan';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useConvexAuth: () => ({ isAuthenticated: false }),
}));

vi.mock('@Ordio/convex', () => ({
  api: {
    jobs: { generateUploadUrl: 'jobs:generateUploadUrl' },
    sessions: { createSession: 'sessions:createSession' },
  },
}));

let computeDurationImpl: () => Promise<number> = () => Promise.resolve(0);
const inputDisposeMock = vi.fn();
const InputCtorMock = vi.fn().mockImplementation(function MockInput() {
  return {
    computeDuration: () => computeDurationImpl(),
    dispose: inputDisposeMock,
  };
});

vi.mock('mediabunny', () => ({
  Input: InputCtorMock,
  BlobSource: vi.fn(),
  ALL_FORMATS: {},
}));

const startEpisodeMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/hooks/audio/useEpisodeIngestion', () => ({
  useEpisodeIngestion: () => ({
    phase: 'idle',
    progress: 0,
    candidates: [],
    episodeFile: null,
    episodeWords: [],
    error: null,
    partialAvailable: false,
    startEpisode: startEpisodeMock,
    usePartialTranscript: vi.fn(),
    cancel: vi.fn(),
  }),
}));

// ── Helpers ──────────────────────────────────────────────────────────

function makeFile(sizeBytes: number, name = 'clip.mp3', type = 'audio/mpeg'): File {
  const file = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

function fileSelectEvent(file: File | null): ChangeEvent<HTMLInputElement> {
  return {
    target: { files: file ? [file] : [], value: '' },
  } as unknown as ChangeEvent<HTMLInputElement>;
}

// Below the size floor a file cannot possibly hold EPISODE_ROUTE_THRESHOLD_SEC
// seconds of audio at the conservative 32kbps minimum bitrate assumption.
const PROBE_SKIP_SIZE_BYTES = (EPISODE_ROUTE_THRESHOLD_SEC * 32_000) / 8;

describe('useCreateFlow.handleFileSelect routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    computeDurationImpl = () => Promise.resolve(0);
  });

  it('skips the duration probe and stages small files directly (short path)', async () => {
    const { useCreateFlow } = await import('@/hooks/recording/useCreateFlow');
    const { result } = renderHook(() => useCreateFlow());
    const smallFile = makeFile(PROBE_SKIP_SIZE_BYTES - 1);

    await act(async () => {
      await result.current.handleFileSelect(fileSelectEvent(smallFile));
    });

    expect(InputCtorMock).not.toHaveBeenCalled();
    expect(startEpisodeMock).not.toHaveBeenCalled();
    expect(result.current.stagedFile).toBe(smallFile);
  });

  it('probes large files but routes to the short path when duration is under the threshold', async () => {
    computeDurationImpl = () => Promise.resolve(EPISODE_ROUTE_THRESHOLD_SEC - 10);
    const { useCreateFlow } = await import('@/hooks/recording/useCreateFlow');
    const { result } = renderHook(() => useCreateFlow());
    const largeShortFile = makeFile(PROBE_SKIP_SIZE_BYTES + 1_000);

    await act(async () => {
      await result.current.handleFileSelect(fileSelectEvent(largeShortFile));
    });

    expect(InputCtorMock).toHaveBeenCalledTimes(1);
    expect(startEpisodeMock).not.toHaveBeenCalled();
    expect(result.current.stagedFile).toBe(largeShortFile);
  });

  it('probes large files and routes to the episode path when duration exceeds the threshold', async () => {
    computeDurationImpl = () => Promise.resolve(EPISODE_ROUTE_THRESHOLD_SEC + 10);
    const { useCreateFlow } = await import('@/hooks/recording/useCreateFlow');
    const { result } = renderHook(() => useCreateFlow());
    const longFile = makeFile(PROBE_SKIP_SIZE_BYTES + 1_000);

    await act(async () => {
      await result.current.handleFileSelect(fileSelectEvent(longFile));
    });

    expect(InputCtorMock).toHaveBeenCalledTimes(1);
    expect(startEpisodeMock).toHaveBeenCalledWith(longFile);
    expect(result.current.stagedFile).toBeNull();
  });

  it('falls through to the short path when the duration probe fails', async () => {
    computeDurationImpl = () => Promise.reject(new Error('unsupported container'));
    const { useCreateFlow } = await import('@/hooks/recording/useCreateFlow');
    const { result } = renderHook(() => useCreateFlow());
    const largeUnprobeableFile = makeFile(PROBE_SKIP_SIZE_BYTES + 1_000);

    await act(async () => {
      await result.current.handleFileSelect(fileSelectEvent(largeUnprobeableFile));
    });

    expect(InputCtorMock).toHaveBeenCalledTimes(1);
    expect(startEpisodeMock).not.toHaveBeenCalled();
    expect(result.current.stagedFile).toBe(largeUnprobeableFile);
  });
});
