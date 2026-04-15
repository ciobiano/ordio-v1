import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnboarding } from '@/hooks/export/useOnboarding';

const LS_KEY = 'ordio_onboarded';

describe('useOnboarding', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('opens dialog when localStorage key is absent', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});
    expect(result.current.open).toBe(true);
  });

  it('does NOT open when already onboarded', async () => {
    localStorage.setItem(LS_KEY, 'true');
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});
    expect(result.current.open).toBe(false);
  });

  it('starts at step 0', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});
    expect(result.current.step).toBe(0);
  });

  it('next() advances step', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});
    act(() => result.current.next());
    expect(result.current.step).toBe(1);
  });

  it('next() advances to step 3 then clamps — slide 4 button calls dismiss()', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});
    act(() => result.current.next()); // 0 → 1
    act(() => result.current.next()); // 1 → 2
    act(() => result.current.next()); // 2 → 3
    act(() => result.current.next()); // stays at 3 (clamp)
    expect(result.current.step).toBe(3);
  });

  it('dismiss() closes dialog and sets localStorage', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});
    expect(result.current.open).toBe(true);
    act(() => result.current.dismiss());
    expect(result.current.open).toBe(false);
    expect(localStorage.getItem(LS_KEY)).toBe('true');
  });
});
