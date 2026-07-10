// apps/web/src/__tests__/useTrimHistory.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTrimHistory } from '@/components/soul/export/useTrimHistory';
import { useCaptureStore, useProcessingStore } from '@/stores';

function makeBuffer(length: number, sampleRate = 48000): AudioBuffer {
  const buf = new AudioBuffer({ numberOfChannels: 1, length, sampleRate });
  buf.getChannelData(0).set(new Float32Array(length).fill(0.5));
  return buf;
}

describe('useTrimHistory', () => {
  beforeEach(() => {
    useCaptureStore.getState().resetCapture();
    useProcessingStore.getState().resetProcessing();
  });

  it('starts with no undo/redo available', () => {
    useCaptureStore.getState().setAudioBuffer(makeBuffer(1000));
    const playback = { load: vi.fn(), duration: 1000 / 48000 } as any;
    const trimmer = { hasChanges: false, isEmpty: false, getTrimmedAudio: vi.fn(), getTrimmedTranscript: vi.fn(), resetAll: vi.fn() } as any;

    const { result } = renderHook(() => useTrimHistory({ playback, trimmer }));

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('commit pushes the pre-commit buffer onto history, enabling undo', () => {
    const original = makeBuffer(1000);
    useCaptureStore.getState().setAudioBuffer(original);
    useProcessingStore.getState().setTranscript([]);

    const trimmedChannel = new Float32Array(500).fill(0.5);
    const playback = { load: vi.fn(), duration: 1000 / 48000 } as any;
    const trimmer = {
      hasChanges: true,
      isEmpty: false,
      getTrimmedAudio: vi.fn(() => [trimmedChannel]),
      getTrimmedTranscript: vi.fn(() => []),
      resetAll: vi.fn(),
    } as any;

    const { result } = renderHook(() => useTrimHistory({ playback, trimmer }));

    act(() => result.current.commit());

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    expect(useCaptureStore.getState().audioBuffer).not.toBe(original);
    expect(useCaptureStore.getState().audioBuffer?.length).toBe(500);
  });

  it('undo restores the previous buffer and enables redo', () => {
    const original = makeBuffer(1000);
    useCaptureStore.getState().setAudioBuffer(original);
    useProcessingStore.getState().setTranscript([]);

    const trimmedChannel = new Float32Array(500).fill(0.5);
    const playback = { load: vi.fn(), duration: 1000 / 48000 } as any;
    const trimmer = {
      hasChanges: true,
      isEmpty: false,
      getTrimmedAudio: vi.fn(() => [trimmedChannel]),
      getTrimmedTranscript: vi.fn(() => []),
      resetAll: vi.fn(),
    } as any;

    const { result } = renderHook(() => useTrimHistory({ playback, trimmer }));
    act(() => result.current.commit());
    act(() => result.current.undo());

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
    expect(useCaptureStore.getState().audioBuffer).toBe(original);
  });
});
