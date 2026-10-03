// apps/web/src/__tests__/useAudioProcessing.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Mock } from 'vitest';
import { AudioProcessingError, useAudioProcessing } from '@/hooks/audio/useAudioProcessing';
import type { UseTranscriptionReturn } from '@/hooks/recording/useTranscription';
import * as recordingDraft from '@/lib/persistence/recordingDraft';

// Mock Convex hooks
vi.mock('convex/react', () => ({
  useMutation: vi.fn(() => vi.fn()),
}));

// Mock @Ordio/convex api
vi.mock('@Ordio/convex', () => ({
  api: {
    jobs: { generateUploadUrl: 'jobs:generateUploadUrl' },
    sessions: { createSession: 'sessions:createSession' },
    transcription: { claimUpload: 'transcription:claimUpload' },
  },
}));

/** Every Blob that was uploaded to storage, in order. */
function uploadedBodies(): Blob[] {
  return (global.fetch as Mock).mock.calls
    .map(([, init]) => (init as RequestInit | undefined)?.body)
    .filter((body): body is Blob => body instanceof Blob);
}

// Store mock state — defined at module scope so they're stable across tests
const mockSetCurrentState = vi.fn();
const mockSetAudioBuffer = vi.fn();
const mockSetAudioBlob = vi.fn();
const mockSetAudioDuration = vi.fn();
const mockSetTranscript = vi.fn();
const mockSetTranscriptionSource = vi.fn();
const mockSetIsEnhancing = vi.fn();
const mockSetEnhanceProgress = vi.fn();
let mockCurrentState: 'idle' | 'recording' = 'idle';

vi.mock('@/stores', () => ({
  useUIStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ setCurrentState: mockSetCurrentState, currentState: mockCurrentState })
  ),
  useCaptureStore: vi.fn(() => ({
    setAudioBuffer: mockSetAudioBuffer,
    setAudioBlob: mockSetAudioBlob,
    setAudioDuration: mockSetAudioDuration,
  })),
  useProcessingStore: Object.assign(
    vi.fn(() => ({
      setTranscript: mockSetTranscript,
      setTranscriptionSource: mockSetTranscriptionSource,
      setIsEnhancing: mockSetIsEnhancing,
      setEnhanceProgress: mockSetEnhanceProgress,
      enhanceTier: 'none',
    })),
    { getState: vi.fn(() => ({ enhanceTier: 'none' })) }
  ),
}));

// Mock audio enhance
vi.mock('@/lib/audioEnhanceApi', () => ({
  enhanceAudio: vi.fn(),
}));

vi.mock('@Ordio/engine/media', () => ({
  decodeBlobToAudioBuffer: vi.fn(),
}));

vi.mock('@/lib/persistence/recordingDraft', () => ({
  clearRecordingDraft: vi.fn().mockResolvedValue(undefined),
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
    const convexReactModule = await import('convex/react');
    (convexReactModule.useMutation as unknown as Mock).mockImplementation(() => vi.fn());
    mockCurrentState = 'idle';
    const channel = new Float32Array(44_100);
    channel.fill(0.1);
    const decodedBuffer = {
      duration: 1,
      length: 44_100,
      numberOfChannels: 1,
      sampleRate: 44_100,
      getChannelData: vi.fn(() => channel),
    } as unknown as AudioBuffer;

    const decodeMod = await import('@Ordio/engine/media');
    (decodeMod.decodeBlobToAudioBuffer as Mock).mockResolvedValue({
      audioBuffer: decodedBuffer,
      decodePath: 'native' as const,
    });

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
    // Re-apply store mock behavior after clearAllMocks
    const storesModule = await import('@/stores');

    // UI Store - uses selector pattern
    const useUIStoreMock = storesModule.useUIStore as unknown as Mock;
    useUIStoreMock.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({ setCurrentState: mockSetCurrentState, currentState: mockCurrentState })
    );

    // Capture Store
    const useCaptureStoreMock = storesModule.useCaptureStore as unknown as Mock;
    useCaptureStoreMock.mockReturnValue({
      setAudioBuffer: mockSetAudioBuffer,
      setAudioBlob: mockSetAudioBlob,
      setAudioDuration: mockSetAudioDuration,
    });

    // Processing Store
    const useProcessingStoreMock = storesModule.useProcessingStore as unknown as Mock & {
      getState: Mock;
    };
    useProcessingStoreMock.mockReturnValue({
      setTranscript: mockSetTranscript,
      setTranscriptionSource: mockSetTranscriptionSource,
      setIsEnhancing: mockSetIsEnhancing,
      setEnhanceProgress: mockSetEnhanceProgress,
    });
    useProcessingStoreMock.getState = vi.fn(() => ({ enhanceTier: 'none' }));
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

  it('clears the recording draft after a session is created successfully', async () => {
    const mockGenerateUploadUrl = vi.fn().mockResolvedValue('https://upload.convex.cloud/abc');
    const mockCreateSession = vi.fn().mockResolvedValue('abc123sessionId');

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

    await act(async () => {
      await result.current.processAudio(blob);
    });

    expect(recordingDraft.clearRecordingDraft).toHaveBeenCalledTimes(1);
  });

  it('restores currentState to the pre-processing state on processing error', async () => {
    mockCurrentState = 'recording';
    // Failing mutation — generateUploadUrl throws
    const failingMutation = vi.fn().mockRejectedValue(new Error('Upload failed'));

    const convexReact = await import('convex/react');
    const useMutationMock = convexReact.useMutation as unknown as Mock;
    useMutationMock.mockReturnValue(failingMutation);

    const blob = new Blob(['audio data'], { type: 'audio/webm' });
    blob.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

    const { result } = renderHook(() => useAudioProcessing(mockTranscription));

    await act(async () => {
      // A failed upload-URL mutation is named, not collapsed into "processing failed".
      await expect(result.current.processAudio(blob)).rejects.toMatchObject({
        stage: 'processing',
        code: 'UPLOAD_URL_FAILED',
      });
    });
    expect(mockSetCurrentState).toHaveBeenNthCalledWith(1, 'processing');
    expect(mockSetCurrentState).toHaveBeenLastCalledWith('recording');
  });

  /* Audio reaches Whisper through storage, never a request body, so a file
     Whisper accepts is transcribed exactly as recorded: uploaded once, and the
     Session keeps that same file. */
  it('uploads a supported Recording once and transcribes that same file', async () => {
    const mockGenerateUploadUrl = vi.fn().mockResolvedValue('https://upload.convex.cloud/abc');
    const mockCreateSession = vi.fn().mockResolvedValue('abc123sessionId');
    const mockClaimUpload = vi.fn().mockResolvedValue('claim_1');

    const convexReact = await import('convex/react');
    const useMutationMock = convexReact.useMutation as unknown as Mock;
    useMutationMock.mockImplementation((ref: string) =>
      ref === 'jobs:generateUploadUrl'
        ? mockGenerateUploadUrl
        : ref === 'sessions:createSession'
          ? mockCreateSession
          : mockClaimUpload
    );

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ storageId: 'storage_abc' }),
    });

    const blob = new Blob(['audio data'], { type: 'audio/webm' });
    blob.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

    const { result } = renderHook(() => useAudioProcessing(mockTranscription));

    await act(async () => {
      await result.current.processAudio(blob);
    });

    expect(uploadedBodies()).toEqual([blob]);
    expect(mockClaimUpload).toHaveBeenCalledWith({ storageId: 'storage_abc' });
    expect(mockTranscription.transcribeAudio).toHaveBeenCalledWith('storage_abc', 1);
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({ storageId: 'storage_abc' })
    );
  });

  it('transcodes unsupported video mime types to wav before transcription', async () => {
    const mockGenerateUploadUrl = vi.fn().mockResolvedValue('https://upload.convex.cloud/abc');
    const mockCreateSession = vi.fn().mockResolvedValue('abc123sessionId');

    const convexReact = await import('convex/react');
    const useMutationMock = convexReact.useMutation as unknown as Mock;
    useMutationMock
      .mockReturnValueOnce(mockGenerateUploadUrl)
      .mockReturnValueOnce(mockCreateSession);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ storageId: 'storage_abc' }),
    });

    const blob = new Blob(['video data'], { type: 'video/quicktime' });
    blob.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

    const { result } = renderHook(() => useAudioProcessing(mockTranscription));

    await act(async () => {
      await result.current.processAudio(blob);
    });

    // The Session keeps the original; Whisper gets a 16kHz WAV of it, uploaded beside it.
    expect(uploadedBodies().map((b) => b.type)).toEqual([blob.type, 'audio/wav']);
    expect(mockTranscription.transcribeAudio).toHaveBeenCalledWith('storage_abc', 1);
  });

  it('transcodes unknown mime uploads to wav before transcription', async () => {
    const mockGenerateUploadUrl = vi.fn().mockResolvedValue('https://upload.convex.cloud/abc');
    const mockCreateSession = vi.fn().mockResolvedValue('abc123sessionId');

    const convexReact = await import('convex/react');
    const useMutationMock = convexReact.useMutation as unknown as Mock;
    useMutationMock
      .mockReturnValueOnce(mockGenerateUploadUrl)
      .mockReturnValueOnce(mockCreateSession);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ storageId: 'storage_abc' }),
    });

    const blob = new Blob(['unknown data'], { type: '' });
    blob.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

    const { result } = renderHook(() => useAudioProcessing(mockTranscription));

    await act(async () => {
      await result.current.processAudio(blob);
    });

    // The Session keeps the original; Whisper gets a 16kHz WAV of it, uploaded beside it.
    expect(uploadedBodies().map((b) => b.type)).toEqual([blob.type, 'audio/wav']);
    expect(mockTranscription.transcribeAudio).toHaveBeenCalledWith('storage_abc', 1);
  });

  it('stops processing immediately when enhancement fails', async () => {
    const convexReact = await import('convex/react');
    const useMutationMock = convexReact.useMutation as unknown as Mock;
    useMutationMock.mockReturnValue(vi.fn());

    const storesModule = await import('@/stores');
    const useProcessingStoreMock = storesModule.useProcessingStore as unknown as Mock & {
      getState: Mock;
    };
    useProcessingStoreMock.getState = vi.fn(() => ({ enhanceTier: 'clean' }));

    const enhanceModule = await import('@/lib/audioEnhanceApi');
    (enhanceModule.enhanceAudio as Mock).mockResolvedValue({
      ok: false,
      blob: new Blob(['fallback'], { type: 'audio/webm' }),
      error: 'Enhancement service unavailable',
      code: 'ENHANCE_SERVICE_ERROR',
    });

    const blob = new Blob(['audio data'], { type: 'audio/webm' });
    blob.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

    const { result } = renderHook(() => useAudioProcessing(mockTranscription));

    await act(async () => {
      await expect(result.current.processAudio(blob)).rejects.toMatchObject({
        stage: 'enhancement',
        code: 'ENHANCE_SERVICE_ERROR',
      });
    });

    expect(mockTranscription.transcribeAudio).not.toHaveBeenCalled();
    expect(mockSetCurrentState).toHaveBeenLastCalledWith('idle');
  });

  it('stops before session creation when transcription fails', async () => {
    const mockGenerateUploadUrl = vi.fn().mockResolvedValue('https://upload.convex.cloud/abc');
    const mockCreateSession = vi.fn().mockResolvedValue('abc123sessionId');

    const convexReact = await import('convex/react');
    const useMutationMock = convexReact.useMutation as unknown as Mock;
    useMutationMock
      .mockReturnValueOnce(mockGenerateUploadUrl)
      .mockReturnValueOnce(mockCreateSession);

    (mockTranscription.transcribeAudio as Mock).mockRejectedValue(
      new Error('Transcription provider unavailable')
    );

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ storageId: 'storage_abc' }),
    });

    const blob = new Blob(['audio data'], { type: 'audio/webm' });
    blob.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

    const { result } = renderHook(() => useAudioProcessing(mockTranscription));

    await act(async () => {
      await expect(result.current.processAudio(blob)).rejects.toMatchObject({
        stage: 'transcription',
      });
    });

    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockSetCurrentState).toHaveBeenLastCalledWith('idle');
  });
});
