import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCapabilities } from '@/hooks/recording/useCapabilities';

describe('useCapabilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('detects canRecord when getUserMedia is available', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }),
      },
    });

    const { result } = renderHook(() => useCapabilities());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.canRecord).toBe(true);
  });

  it('reports canRecord false when getUserMedia is missing', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      writable: true,
      value: {},
    });

    const { result } = renderHook(() => useCapabilities());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.canRecord).toBe(false);
    expect(result.current.warnings.some((w) => w.includes('Microphone'))).toBe(true);
  });

  it('resolves to not loading after detection', async () => {
    const { result } = renderHook(() => useCapabilities());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isLoading).toBe(false);
  });

  it('exposes warnings as an array', async () => {
    const { result } = renderHook(() => useCapabilities());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(Array.isArray(result.current.warnings)).toBe(true);
  });
});
