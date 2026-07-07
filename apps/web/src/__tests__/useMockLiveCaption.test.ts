// apps/web/src/__tests__/useMockLiveCaption.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMockLiveCaption } from '@/components/soul/capture/useMockLiveCaption';

describe('useMockLiveCaption', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is empty while isSpeaking is false', () => {
    const { result } = renderHook(() => useMockLiveCaption(false));
    expect(result.current).toBe('');
  });

  it('starts revealing words once isSpeaking becomes true', () => {
    const { result, rerender } = renderHook(({ isSpeaking }) => useMockLiveCaption(isSpeaking), {
      initialProps: { isSpeaking: false },
    });
    expect(result.current).toBe('');

    rerender({ isSpeaking: true });
    act(() => {
      vi.advanceTimersByTime(260);
    });
    expect(result.current.length).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(260);
    });
    expect(result.current.split(' ').length).toBeGreaterThan(1);
  });

  it('resets to empty the instant isSpeaking goes false, mid-phrase', () => {
    const { result, rerender } = renderHook(({ isSpeaking }) => useMockLiveCaption(isSpeaking), {
      initialProps: { isSpeaking: true },
    });

    act(() => {
      vi.advanceTimersByTime(520);
    });
    expect(result.current).not.toBe('');

    rerender({ isSpeaking: false });
    expect(result.current).toBe('');
  });

  it('cleans up its timer on unmount without throwing', () => {
    const { unmount } = renderHook(() => useMockLiveCaption(true));
    act(() => {
      vi.advanceTimersByTime(260);
    });
    expect(() => unmount()).not.toThrow();
  });
});
