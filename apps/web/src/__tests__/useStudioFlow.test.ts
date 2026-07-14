import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useStudioFlow } from '@/hooks/studio/useStudioFlow';

const startRecording = vi.fn(async () => ({}) as unknown as MediaStream);
const stopRecording = vi.fn();
const connectStream = vi.fn();
const disconnect = vi.fn();
const transcribeAudio = vi.fn(async () => []);
const clearTranscript = vi.fn();
const processAudio = vi.fn(async () => 'session-123');

vi.mock('@/hooks/audio/useAudioRecorder', () => ({
  useAudioRecorder: () => ({
    isRecording: false,
    recordingTime: 0,
    audioBlob: new Blob(['x']),
    error: null,
    startRecording,
    stopRecording,
  }),
}));
vi.mock('@/hooks/audio/useAudioAnalyser', () => ({
  useAudioAnalyser: () => ({ connectStream, getAudioLevel: () => 0.4, disconnect }),
}));
vi.mock('@/hooks/recording/useTranscription', () => ({
  useTranscription: () => ({
    transcript: [],
    isTranscribing: false,
    error: null,
    transcribeAudio,
    clearTranscript,
  }),
}));
vi.mock('@/hooks/audio/useAudioProcessing', () => ({
  useAudioProcessing: () => ({ processingProgress: 0, processAudio, cancelProcessing: vi.fn() }),
}));

describe('useStudioFlow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts in idle', () => {
    const { result } = renderHook(() => useStudioFlow());
    expect(result.current.view).toBe('idle');
  });

  it('moves to capture on startRecording', async () => {
    const { result } = renderHook(() => useStudioFlow());
    await act(async () => {
      await result.current.startRecording();
    });
    expect(startRecording).toHaveBeenCalled();
    expect(result.current.view).toBe('capture');
  });

  it('moves capture -> processing -> edit on stopRecording, setting sessionId', async () => {
    const { result } = renderHook(() => useStudioFlow());
    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      await result.current.stopRecording();
    });
    expect(stopRecording).toHaveBeenCalled();
    expect(processAudio).toHaveBeenCalled();
    await waitFor(() => expect(result.current.view).toBe('edit'));
    expect(result.current.sessionId).toBe('session-123');
  });

  it('openClip jumps straight to edit with the given sessionId', () => {
    const { result } = renderHook(() => useStudioFlow());
    act(() => result.current.openClip('older-session'));
    expect(result.current.view).toBe('edit');
    expect(result.current.sessionId).toBe('older-session');
  });

  it('goIdle resets view and sessionId', () => {
    const { result } = renderHook(() => useStudioFlow());
    act(() => result.current.openClip('older-session'));
    act(() => result.current.goIdle());
    expect(result.current.view).toBe('idle');
    expect(result.current.sessionId).toBeNull();
  });

  it('goExport moves to export', () => {
    const { result } = renderHook(() => useStudioFlow());
    act(() => result.current.openClip('s1'));
    act(() => result.current.goExport());
    expect(result.current.view).toBe('export');
  });
});
