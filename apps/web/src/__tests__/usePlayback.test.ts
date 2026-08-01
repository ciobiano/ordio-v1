import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlayback } from '@/hooks/playback/usePlayback';

/**
 * Backgrounding the tab suspends the AudioContext and freezes rAF. Nothing in
 * the browser tells the hook this happened, so unless it listens for the
 * visibility change its own state drifts out of sync with reality — it still
 * believes it is playing, and the play/pause button then routes the user's tap
 * to the wrong branch.
 */

interface FakeSource {
  connect: () => void;
  start: (when?: number, offset?: number) => void;
  stop: (when?: number) => void;
  buffer: AudioBuffer | null;
  onended: (() => void) | null;
}

class FakeAudioContext {
  state: AudioContextState = 'running';
  currentTime = 0;
  destination = {} as AudioDestinationNode;
  resumeCount = 0;
  sources: FakeSource[] = [];

  createBufferSource(): FakeSource {
    const source: FakeSource = {
      connect: () => {},
      start: () => {},
      stop: () => {},
      buffer: null,
      onended: null,
    };
    this.sources.push(source);
    return source;
  }

  async resume(): Promise<void> {
    this.resumeCount++;
    this.state = 'running';
  }

  close(): void {
    this.state = 'closed';
  }
}

let ctx: FakeAudioContext;

/** The browser suspending audio behind our back, exactly as backgrounding does. */
function browserSuspends() {
  ctx.state = 'suspended';
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: hidden ? 'hidden' : 'visible',
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

const buffer = { duration: 30 } as AudioBuffer;

beforeEach(() => {
  ctx = new FakeAudioContext();
  // Plain assignment, not vi.stubGlobal: setup.ts defines AudioContext as
  // writable but not configurable, so redefining the property throws.
  // A real `function`, not an arrow — the hook calls `new AudioContext()`.
  (window as unknown as { AudioContext: unknown }).AudioContext = function () {
    return ctx;
  };
  // Keep the time loop from actually spinning; these tests assert state, not frames.
  window.requestAnimationFrame = vi.fn(() => 1);
  window.cancelAnimationFrame = vi.fn();
  setHidden(false);
});

describe('usePlayback across tab visibility', () => {
  it('does not keep reporting playback after the tab is backgrounded', async () => {
    const { result } = renderHook(() => usePlayback());

    act(() => result.current.load(buffer));
    await act(async () => {
      await result.current.play();
    });
    expect(result.current.isPlaying).toBe(true);

    // Tab goes away: the browser suspends audio, rAF stops, nothing else fires.
    browserSuspends();
    act(() => setHidden(true));

    // Reporting "playing" here is what sends the user's next tap to pause().
    expect(result.current.isPlaying).toBe(false);
  });

  it('keeps the playhead where the audio actually stopped', async () => {
    const { result } = renderHook(() => usePlayback());

    act(() => result.current.load(buffer));
    await act(async () => {
      await result.current.play();
    });

    ctx.currentTime = 7;
    browserSuspends();
    act(() => setHidden(true));

    expect(result.current.currentTime).toBeCloseTo(7, 1);
  });

  it('resumes on a single play() after coming back', async () => {
    const { result } = renderHook(() => usePlayback());

    act(() => result.current.load(buffer));
    await act(async () => {
      await result.current.play();
    });

    ctx.currentTime = 7;
    browserSuspends();
    act(() => setHidden(true));
    act(() => setHidden(false));

    const before = ctx.resumeCount;
    await act(async () => {
      await result.current.play();
    });

    expect(result.current.isPlaying).toBe(true);
    expect(ctx.resumeCount).toBeGreaterThan(before);
  });

  it("resumes a context Safari left 'interrupted', not just 'suspended'", async () => {
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.load(buffer));

    // iOS uses a non-standard 'interrupted' state after an audio interruption.
    ctx.state = 'interrupted' as AudioContextState;

    await act(async () => {
      await result.current.play();
    });

    expect(ctx.resumeCount).toBe(1);
    expect(result.current.isPlaying).toBe(true);
  });

  it('a double tap cannot start two overlapping sources', async () => {
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.load(buffer));

    // What a user does when the button appears dead: tap twice, fast. play()
    // awaits ctx.resume(), so both calls can pass a guard checked before it.
    await act(async () => {
      await Promise.all([result.current.play(), result.current.play()]);
    });

    expect(ctx.sources).toHaveLength(1);
  });
});
