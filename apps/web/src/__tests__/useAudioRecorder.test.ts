import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioRecorder } from '@/hooks/audio/useAudioRecorder';
import * as recordingDraft from '@/lib/persistence/recordingDraft';

vi.mock('@/lib/persistence/recordingDraft', () => ({
  saveRecordingDraft: vi.fn().mockResolvedValue(undefined),
  clearRecordingDraft: vi.fn().mockResolvedValue(undefined),
}));

describe('hooks/audio: useAudioRecorder autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('persists a draft periodically while recording', async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    const recorderInstance = (window.MediaRecorder as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    act(() => {
      recorderInstance.ondataavailable({ data: new Blob(['chunk']), size: 5 } as unknown as BlobEvent);
    });

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(recordingDraft.saveRecordingDraft).toHaveBeenCalled();
  });

  it('persists a draft immediately on stop', async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    const recorderInstance = (window.MediaRecorder as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    act(() => {
      recorderInstance.ondataavailable({ data: new Blob(['chunk']), size: 5 } as unknown as BlobEvent);
    });

    vi.clearAllMocks();

    act(() => {
      result.current.stopRecording();
      recorderInstance.onstop();
    });

    expect(recordingDraft.saveRecordingDraft).toHaveBeenCalledTimes(1);
  });

  it('clears the draft on resetRecording', async () => {
    const { result } = renderHook(() => useAudioRecorder());

    act(() => {
      result.current.resetRecording();
    });

    expect(recordingDraft.clearRecordingDraft).toHaveBeenCalledTimes(1);
  });
});
