import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlayback } from '@/hooks/playback/usePlayback';

/**
 * Backgrounding the tab suspends the AudioContext and freezes rAF. Nothing in
 * the browser tells the hook this happened, so unless it listens for the
 * visibility change its own state drifts out of sync with reality — it still
 * believes it is playing, and the play/pause button then routes the user's tap
 * to the wrong branch.
 *
 * Worse, the context may not come back. iOS parks a backgrounded context in the
 * non-standard 'interrupted' state, where resume() can return a promise that
 * never settles — not rejects, never settles. play() claims its guard flag
 * before that await, so a bare await left the flag set with no catch or finally
 * ever running: the button was dead until a page refresh.
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
  /** Reproduces the iOS hang: resume() is called and simply never comes back. */
  resumeNeverSettles = false;

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

  resume(): Promise<void> {
    this.resumeCount++;
    if (this.resumeNeverSettles) return new Promise<void>(() => {});
    this.state = 'running';
    return Promise.resolve();
  }

  /** Async, like the real one — the hook chains .catch() onto it. */
  async close(): Promise<void> {
    this.state = 'closed';
  }
}

/** Every context the hook has built, oldest first. */
let contexts: FakeAudioContext[] = [];

/** The one the hook is using now — always the most recent it constructed. */
function ctx(): FakeAudioContext {
  return contexts[contexts.length - 1];
}

/** The browser suspending audio behind our back, exactly as backgrounding does. */
function browserSuspends() {
  ctx().state = 'suspended';
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
  contexts = [];
  // Plain assignment, not vi.stubGlobal: setup.ts defines AudioContext as
  // writable but not configurable, so redefining the property throws.
  // A real `function`, not an arrow — the hook calls `new AudioContext()`.
  // A fresh instance per call, because recovering from a wedged context means
  // building a new one and the test has to be able to tell them apart.
  (window as unknown as { AudioContext: unknown }).AudioContext = function () {
    const next = new FakeAudioContext();
    contexts.push(next);
    return next;
  };
  // Keep the time loop from actually spinning; these tests assert state, not frames.
  window.requestAnimationFrame = vi.fn(() => 1);
  window.cancelAnimationFrame = vi.fn();
  setHidden(false);
});

afterEach(() => {
  vi.useRealTimers();
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

    ctx().currentTime = 7;
    browserSuspends();
    act(() => setHidden(true));

    expect(result.current.currentTime).toBeCloseTo(7, 1);
  });

  it('plays again on a single tap after coming back', async () => {
    const { result } = renderHook(() => usePlayback());

    act(() => result.current.load(buffer));
    await act(async () => {
      await result.current.play();
    });

    ctx().currentTime = 7;
    browserSuspends();
    act(() => setHidden(true));
    act(() => setHidden(false));

    await act(async () => {
      await result.current.play();
    });

    expect(result.current.isPlaying).toBe(true);
  });

  it('retires a context the OS parked, rather than trying to revive it', async () => {
    const { result } = renderHook(() => usePlayback());

    act(() => result.current.load(buffer));
    await act(async () => {
      await result.current.play();
    });
    const parked = ctx();

    browserSuspends();
    act(() => setHidden(true));
    act(() => setHidden(false));

    // Dropped on the way back in, so the next tap does not have to resurrect
    // it — and can build its replacement synchronously, inside its own gesture,
    // which is what iOS requires.
    expect(parked.state).toBe('closed');

    await act(async () => {
      await result.current.play();
    });
    expect(contexts).toHaveLength(2);
    expect(result.current.isPlaying).toBe(true);
  });

  it('leaves a healthy context alone when the tab comes back', async () => {
    const { result } = renderHook(() => usePlayback());

    act(() => result.current.load(buffer));
    await act(async () => {
      await result.current.play();
    });

    // pause() stops the source node; it does not suspend the context. Anything
    // still 'running' here was never parked and must not be thrown away.
    act(() => result.current.pause());
    act(() => setHidden(true));
    act(() => setHidden(false));

    expect(ctx().state).toBe('running');
    expect(contexts).toHaveLength(1);
  });

  it("resumes a context Safari left 'interrupted', not just 'suspended'", async () => {
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.load(buffer));

    // The context is built lazily by the first play(), so it has to exist
    // before it can be interrupted.
    await act(async () => {
      await result.current.play();
    });
    act(() => result.current.pause());
    expect(ctx().resumeCount).toBe(0);

    // iOS uses this non-standard state after an audio interruption. Checking
    // only for 'suspended' would skip the resume and leave a frozen clock.
    ctx().state = 'interrupted' as AudioContextState;

    await act(async () => {
      await result.current.play();
    });

    expect(ctx().resumeCount).toBe(1);
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

    expect(ctx().sources).toHaveLength(1);
  });
});

/**
 * An interruption with no visibility change — a phone call, another app taking
 * audio focus. The retire-on-return handler never fires, so the tap itself has
 * to survive meeting a context that will not come back.
 */
describe('usePlayback when the AudioContext will not resume', () => {
  /** Drive play() past the resume timeout without waiting on a real clock. */
  async function playThroughTimeout(play: () => Promise<void>) {
    await act(async () => {
      const pending = play();
      await vi.advanceTimersByTimeAsync(1_000);
      await pending;
    });
  }

  /** Play once so a context exists, then have the OS wedge it. */
  async function withWedgedContext() {
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.load(buffer));
    await act(async () => {
      await result.current.play();
    });
    act(() => result.current.pause());

    const wedged = ctx();
    wedged.state = 'interrupted' as AudioContextState;
    wedged.resumeNeverSettles = true;

    return { result, wedged };
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('gives up on a resume that never settles instead of hanging forever', async () => {
    const { result } = await withWedgedContext();

    await playThroughTimeout(() => result.current.play());

    // The tap fails, which is unavoidable — but it fails, rather than never
    // returning. A bare await here left play() pending forever.
    expect(result.current.isPlaying).toBe(false);
  });

  it('leaves the button working: the very next tap plays', async () => {
    const { result } = await withWedgedContext();
    await playThroughTimeout(() => result.current.play());

    // This is the actual regression. play() claims its re-entry guard before
    // awaiting resume(), so a hang used to strand the flag set — and every
    // later tap returned early at the guard. Dead until refresh.
    await act(async () => {
      await result.current.play();
    });

    expect(result.current.isPlaying).toBe(true);
    expect(contexts).toHaveLength(2);
  });

  it('discards the wedged context rather than retrying it', async () => {
    const { result, wedged } = await withWedgedContext();

    await playThroughTimeout(() => result.current.play());

    expect(wedged.state).toBe('closed');
  });
});
