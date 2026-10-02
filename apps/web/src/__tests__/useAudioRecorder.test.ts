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

  it('does not resurrect a draft or clobber state when onstop fires after resetRecording (discard race)', async () => {
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
      result.current.resetRecording();
    });

    // MediaRecorder's real 'stop' event fires asynchronously — simulate it
    // landing after resetRecording already cleared state/chunks/draft.
    act(() => {
      recorderInstance.onstop();
    });

    expect(recordingDraft.saveRecordingDraft).not.toHaveBeenCalled();
    expect(result.current.state).toBe('idle');
    expect(result.current.audioBlob).toBeNull();
  });

  it('rejects with the named reason when the microphone is refused', async () => {
    const getUserMedia = navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>;
    getUserMedia.mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'));
    const { result } = renderHook(() => useAudioRecorder());

    /* The reason travels on the rejection: \`error\` is React state, and the
       caller's next line still sees the previous render's value. */
    await act(async () => {
      await expect(result.current.startRecording()).rejects.toMatchObject({
        code: 'MIC_PERMISSION_DENIED',
      });
    });
    expect(result.current.error?.code).toBe('MIC_PERMISSION_DENIED');
    expect(result.current.state).toBe('idle');
  });
});
