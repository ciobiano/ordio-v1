import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStudioEdits } from '@/hooks/studio/useStudioEdits';
import type { Word } from '@Ordio/shared/schemas';

// Covers useStudioEdits' own orchestration logic, which had zero test
// coverage: filler-word marking, the commit/undo/redo snapshot history
// (including the MAX_HISTORY cap and the session-switch reset), the
// "cuts would remove the entire clip" guard, and the cutRanges overlap-merge
// algorithm used to paint the timeline.

const setAudioBuffer = vi.fn((buf: AudioBuffer) => {
  captureState = { ...captureState, audioBuffer: buf };
});
const setAudioDuration = vi.fn();
const setTranscript = vi.fn((t: Word[]) => {
  processingState = { ...processingState, transcript: t };
});
const load = vi.fn();
const playback = { load };

let captureState: { audioBuffer: AudioBuffer | null };
let processingState: { transcript: Word[] };

vi.mock('@/stores', () => ({
  useCaptureStore: Object.assign(
    (selector: (s: typeof captureState) => unknown) => selector(captureState),
    { getState: () => ({ ...captureState, setAudioBuffer, setAudioDuration }) }
  ),
  useProcessingStore: Object.assign(
    (selector: (s: typeof processingState) => unknown) => selector(processingState),
    { getState: () => ({ ...processingState, setTranscript }) }
  ),
}));

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

function makeBuffer(durationSec: number, sampleRate = 100): AudioBuffer {
  return new AudioBuffer({ length: durationSec * sampleRate, numberOfChannels: 1, sampleRate });
}

describe('useStudioEdits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captureState = { audioBuffer: makeBuffer(2) };
    processingState = {
      transcript: [
        { text: 'hello', start: 0, end: 1 },
        { text: 'world', start: 1, end: 2 },
      ],
    };
  });

  it('commits deleted words: splices the audio, re-times the transcript, and enables undo', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useStudioEdits(playback, 's1'));

    act(() => result.current.trimmer.toggleWordDeletion(0));
    act(() => result.current.commit());

    expect(setAudioBuffer).toHaveBeenCalledTimes(1);
    const nextBuffer = setAudioBuffer.mock.calls[0][0] as AudioBuffer;
    expect(nextBuffer.duration).toBeCloseTo(1, 5);
    expect(setTranscript).toHaveBeenCalledWith([
      expect.objectContaining({ text: 'world', start: 0, end: 1 }),
    ]);
    expect(load).toHaveBeenCalledWith(nextBuffer);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('does nothing when there are no pending changes', () => {
    const { result } = renderHook(() => useStudioEdits(playback, 's1'));
    act(() => result.current.commit());
    expect(setAudioBuffer).not.toHaveBeenCalled();
    expect(result.current.canUndo).toBe(false);
  });

  it('blocks a commit that would remove the entire clip', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useStudioEdits(playback, 's1'));

    act(() => result.current.trimmer.setStartTime(2));
    act(() => result.current.commit());

    expect(setAudioBuffer).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('These cuts would remove the entire clip.');
  });

  it('undo restores the pre-commit snapshot and redo replays it forward', () => {
    const originalBuffer = captureState.audioBuffer;
    const originalTranscript = processingState.transcript;
    const { result, rerender } = renderHook(() => useStudioEdits(playback, 's1'));

    act(() => result.current.trimmer.toggleWordDeletion(0));
    act(() => result.current.commit());
    rerender(); // pick up the store mutations commit() just made

    act(() => result.current.undo());
    expect(setAudioBuffer).toHaveBeenLastCalledWith(originalBuffer);
    expect(setTranscript).toHaveBeenLastCalledWith(originalTranscript);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
    rerender();

    const committedBuffer = setAudioBuffer.mock.calls[0][0] as AudioBuffer;
    act(() => result.current.redo());
    expect(setAudioBuffer).toHaveBeenLastCalledWith(committedBuffer);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('resets pending trim state and history when the session changes', () => {
    const { result, rerender } = renderHook(
      ({ sessionId }) => useStudioEdits(playback, sessionId),
      { initialProps: { sessionId: 's1' } }
    );

    act(() => result.current.trimmer.toggleWordDeletion(0));
    act(() => result.current.commit());
    expect(result.current.canUndo).toBe(true);

    rerender({ sessionId: 's2' });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('marks filler words and reports how many were found', async () => {
    processingState = {
      transcript: [
        { text: 'um', start: 0, end: 0.3 },
        { text: 'so anyway', start: 0.3, end: 1 },
        { text: 'uh,', start: 1, end: 1.2 },
      ],
    };
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useStudioEdits(playback, 's1'));

    act(() => result.current.markFillerWords());

    expect(result.current.trimmer.trimState.deletedWordIndices).toEqual(new Set([0, 2]));
    expect(toast.success).toHaveBeenCalledWith('Marked 2 filler words');
  });

  it('reports no filler words found and marks nothing', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useStudioEdits(playback, 's1'));

    act(() => result.current.markFillerWords());

    expect(result.current.trimmer.trimState.deletedWordIndices.size).toBe(0);
    expect(toast.info).toHaveBeenCalledWith('No filler words found.');
  });

  it('merges adjacent/overlapping cut ranges (head trim, deleted word, silence) within the 0.02s tolerance', () => {
    processingState = {
      transcript: [
        { text: 'hello', start: 0.5, end: 1 },
        { text: 'world', start: 1.01, end: 1.5 },
      ],
    };
    const { result } = renderHook(() => useStudioEdits(playback, 's1'));

    act(() => result.current.trimmer.setStartTime(0.5));
    act(() => result.current.trimmer.toggleWordDeletion(0));
    act(() => result.current.trimmer.toggleWordDeletion(1));

    // Head trim [0, 0.5] + word 0 [0.5, 1] + word 1 [1.01, 1.5] are all within
    // 0.02s of their neighbor, so they should collapse into one merged range.
    expect(result.current.cutRanges).toEqual([{ start: 0, end: 1.5 }]);
  });
});
