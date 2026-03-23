// apps/web/src/__tests__/useAudioProcessing.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Mock } from 'vitest';
import { useAudioProcessing } from '@/hooks/useAudioProcessing';
import type { UseTranscriptionReturn } from '@/hooks/useTranscription';

// Mock Convex hooks
vi.mock('convex/react', () => ({
  useMutation: vi.fn(() => vi.fn()),
}));

// Mock @Ordio/convex api
vi.mock('@Ordio/convex', () => ({
  api: {
    jobs: { generateUploadUrl: 'jobs:generateUploadUrl' },
    sessions: { createSession: 'sessions:createSession' },
  },
}));

// Store mock state — defined at module scope so they're stable across tests
const mockSetCurrentState = vi.fn();
const mockSetAudioBuffer = vi.fn();
const mockSetAudioBlob = vi.fn();
const mockSetAudioDuration = vi.fn();
const mockSetTranscript = vi.fn();
const mockSetTranscriptionSource = vi.fn();
const mockSetIsEnhancing = vi.fn();
const mockSetEnhanceProgress = vi.fn();

vi.mock('@/lib/store', () => ({
  useStore: Object.assign(
    vi.fn(() => ({
      setCurrentState: mockSetCurrentState,
      setAudioBuffer: mockSetAudioBuffer,
      setAudioBlob: mockSetAudioBlob,
      setAudioDuration: mockSetAudioDuration,
      setTranscript: mockSetTranscript,
      setTranscriptionSource: mockSetTranscriptionSource,
      setIsEnhancing: mockSetIsEnhancing,
      setEnhanceProgress: mockSetEnhanceProgress,
    })),
    { getState: vi.fn(() => ({ enhanceTier: 'none' })) }
  ),
}));

// Mock audio enhance
vi.mock('@/lib/audioEnhanceApi', () => ({
  enhanceAudio: vi.fn(),
}));

// AudioContext mock with decodeAudioData — defined as a proper class so `new` works
const mockDecodeAudioData = vi.fn();
const mockAudioContextClose = vi.fn();

class MockAudioContext {
  decodeAudioData = mockDecodeAudioData;
  close = mockAudioContextClose;
  createBufferSource = vi.fn();
  destination = {};
  state = 'running';
}

// Override setup.ts's AudioContext with our richer mock.
// setup.ts uses writable:true so direct assignment works.
window.AudioContext = MockAudioContext as unknown as typeof AudioContext;

// Minimal transcription mock satisfying UseTranscriptionReturn
const mockTranscription: UseTranscriptionReturn = {
  transcribeAudio: vi.fn(),
  clearTranscript: vi.fn(),
  isTranscribing: false,
  transcript: [],
  error: null,
};

describe('useAudioProcessing', () => {
  beforeEach(async () => {
    // Reset call counts but preserve mock implementations
    vi.clearAllMocks();

    // Re-apply mock implementations after clearAllMocks
    mockDecodeAudioData.mockResolvedValue({
      duration: 5.0,
      numberOfChannels: 1,
      sampleRate: 44100,
    });
    mockAudioContextClose.mockResolvedValue(undefined);
    (mockTranscription.transcribeAudio as Mock).mockResolvedValue([
      { text: 'hello', start: 0, end: 1 },
    ]);

    // Re-apply store mock (clearAllMocks resets the vi.fn() factory return value)
    const storeReturnValue = {
      setCurrentState: mockSetCurrentState,
      setAudioBuffer: mockSetAudioBuffer,
      setAudioBlob: mockSetAudioBlob,
      setAudioDuration: mockSetAudioDuration,
      setTranscript: mockSetTranscript,
      setTranscriptionSource: mockSetTranscriptionSource,
      setIsEnhancing: mockSetIsEnhancing,
      setEnhanceProgress: mockSetEnhanceProgress,
    };

    // Re-apply store mock behavior after clearAllMocks
    const storeModule = await import('@/lib/store');
    const useStoreMock = storeModule.useStore as unknown as Mock & {
      getState: Mock;
    };
    useStoreMock.mockReturnValue(storeReturnValue);
    useStoreMock.getState = vi.fn(() => ({ enhanceTier: 'none' }));
  });

  it('returns a string sessionId on success', async () => {
    const mockGenerateUploadUrl = vi.fn().mockResolvedValue('https://upload.convex.cloud/abc');
    const mockCreateSession = vi.fn().mockResolvedValue('abc123sessionId');

    // Configure useMutation BEFORE renderHook so hook initialises with these fns
    const convexReact = await import('convex/react');
    const useMutationMock = convexReact.useMutation as unknown as Mock;
    useMutationMock
      .mockReturnValueOnce(mockGenerateUploadUrl)
      .mockReturnValueOnce(mockCreateSession);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ storageId: 'storage_abc' }),
    });

    const blob = new Blob(['audio data'], { type: 'audio/webm' });
    blob.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

    const { result } = renderHook(() => useAudioProcessing(mockTranscription));

    let sessionId: string | undefined;
    await act(async () => {
      sessionId = await result.current.processAudio(blob);
    });

    expect(typeof sessionId).toBe('string');
    expect(sessionId).toBe('abc123sessionId');
  });

  it('sets currentState to idle and throws on processing error', async () => {
    // Failing mutation — generateUploadUrl throws
    const failingMutation = vi.fn().mockRejectedValue(new Error('Upload failed'));

    const convexReact = await import('convex/react');
    const useMutationMock = convexReact.useMutation as unknown as Mock;
    useMutationMock.mockReturnValue(failingMutation);

    const blob = new Blob(['audio data'], { type: 'audio/webm' });
    blob.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

    const { result } = renderHook(() => useAudioProcessing(mockTranscription));

    await act(async () => {
      await expect(result.current.processAudio(blob)).rejects.toThrow(
        'Audio processing failed'
      );
    });

    expect(mockSetCurrentState).toHaveBeenCalledWith('idle');
  });
});
