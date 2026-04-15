import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioTrimmer } from '@/hooks/audio/useAudioTrimmer';
import type { Word } from '@Ordio/shared/schemas';

describe('useAudioTrimmer', () => {
  const sampleRate = 44100;

  it('initializes with full duration range and no deletions', () => {
    const { result } = renderHook(() => useAudioTrimmer(10));
    expect(result.current.trimState.startTime).toBe(0);
    expect(result.current.trimState.endTime).toBe(10);
    expect(result.current.trimState.deletedWordIndices.size).toBe(0);
  });

  it('updates start and end times', () => {
    const { result } = renderHook(() => useAudioTrimmer(10));
    act(() => result.current.setStartTime(2));
    act(() => result.current.setEndTime(8));
    expect(result.current.trimState.startTime).toBe(2);
    expect(result.current.trimState.endTime).toBe(8);
  });

  it('clamps start time to valid range', () => {
    const { result } = renderHook(() => useAudioTrimmer(10));
    act(() => result.current.setStartTime(-1));
    expect(result.current.trimState.startTime).toBe(0);
    act(() => result.current.setStartTime(11));
    expect(result.current.trimState.startTime).toBe(10);
  });

  it('toggles word deletion', () => {
    const { result } = renderHook(() => useAudioTrimmer(10));
    act(() => result.current.toggleWordDeletion(3));
    expect(result.current.trimState.deletedWordIndices.has(3)).toBe(true);
    act(() => result.current.toggleWordDeletion(3));
    expect(result.current.trimState.deletedWordIndices.has(3)).toBe(false);
  });

  it('clears all deletions', () => {
    const { result } = renderHook(() => useAudioTrimmer(10));
    act(() => result.current.toggleWordDeletion(1));
    act(() => result.current.toggleWordDeletion(5));
    act(() => result.current.clearDeletions());
    expect(result.current.trimState.deletedWordIndices.size).toBe(0);
  });

  it('filters transcript by time range and deleted indices', () => {
    const { result } = renderHook(() => useAudioTrimmer(10));
    const transcript: Word[] = [
      { text: 'hello', start: 0, end: 0.5 },
      { text: 'um', start: 1, end: 1.2 },
      { text: 'world', start: 2, end: 2.5 },
      { text: 'today', start: 9, end: 9.5 },
    ];

    act(() => {
      result.current.setStartTime(0.5);
      result.current.setEndTime(8);
      result.current.toggleWordDeletion(1); // delete "um"
    });

    const trimmed = result.current.getTrimmedTranscript(transcript);
    expect(trimmed.map((w) => w.text)).toEqual(['world']);
  });

  it('rebases timestamps after word deletion', () => {
    const { result } = renderHook(() => useAudioTrimmer(10));
    const transcript: Word[] = [
      { text: 'hello', start: 0, end: 0.5 },
      { text: 'um', start: 1, end: 1.5 },
      { text: 'world', start: 2, end: 2.5 },
    ];

    act(() => result.current.toggleWordDeletion(1)); // delete "um" (0.5s duration)

    const trimmed = result.current.getTrimmedTranscript(transcript);
    // "world" should shift earlier by 0.5s (duration of "um")
    expect(trimmed[1].text).toBe('world');
    expect(trimmed[1].start).toBeCloseTo(1.5);
    expect(trimmed[1].end).toBeCloseTo(2.0);
  });

  it('reports hasChanges correctly', () => {
    const { result } = renderHook(() => useAudioTrimmer(10));
    expect(result.current.hasChanges).toBe(false);
    act(() => result.current.setStartTime(1));
    expect(result.current.hasChanges).toBe(true);
  });

  it('reports isEmpty when all content is trimmed', () => {
    const { result } = renderHook(() => useAudioTrimmer(10));
    act(() => result.current.setStartTime(10)); // start >= end
    expect(result.current.isEmpty).toBe(true);
  });

  it('clamps end time to valid range', () => {
    const { result } = renderHook(() => useAudioTrimmer(10));
    act(() => result.current.setEndTime(-1));
    expect(result.current.trimState.endTime).toBe(0);
    act(() => result.current.setEndTime(15));
    expect(result.current.trimState.endTime).toBe(10);
  });

  describe('getTrimmedAudio', () => {
    function createMockBuffer(samples: number, sampleRate = 44100): AudioBuffer {
      return {
        sampleRate,
        numberOfChannels: 1,
        length: samples,
        duration: samples / sampleRate,
        getChannelData: () => {
          const data = new Float32Array(samples);
          for (let i = 0; i < samples; i++) data[i] = i / samples;
          return data;
        },
      } as unknown as AudioBuffer;
    }

    it('trims audio to start/end times', () => {
      const buffer = createMockBuffer(44100); // 1 second at 44100
      const { result } = renderHook(() => useAudioTrimmer(1));
      act(() => {
        result.current.setStartTime(0.25);
        result.current.setEndTime(0.75);
      });
      const channels = result.current.getTrimmedAudio(buffer, []);
      expect(channels).toHaveLength(1);
      expect(channels[0].length).toBe(Math.floor(0.75 * 44100) - Math.floor(0.25 * 44100));
    });

    it('splices out deleted word ranges', () => {
      const buffer = createMockBuffer(44100 * 3, 44100); // 3 seconds
      const transcript: Word[] = [
        { text: 'hello', start: 0, end: 1 },
        { text: 'um', start: 1, end: 1.5 },
        { text: 'world', start: 1.5, end: 3 },
      ];
      const { result } = renderHook(() => useAudioTrimmer(3));
      act(() => result.current.toggleWordDeletion(1)); // delete "um" (0.5s)
      const channels = result.current.getTrimmedAudio(buffer, transcript);
      expect(channels[0].length).toBe(44100 * 3 - Math.floor(0.5 * 44100));
    });
  });
});
