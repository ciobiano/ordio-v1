'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export interface UsePlaybackReturn {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  load: (buffer: AudioBuffer, range?: { start: number; end: number }) => void;
  stop: () => void;
  previewAt: (time: number, previewDuration?: number) => Promise<void>;
  registerTimeListener: (fn: (t: number, d: number) => void) => () => void;
}

/**
 * A resume that has not come back by now is not coming back.
 *
 * A genuine resume settles in single-digit milliseconds; this only has to be
 * long enough not to give up on a slow one.
 */
const RESUME_TIMEOUT_MS = 400;

/**
 * Bring a context back to `running`, or report that it cannot be.
 *
 * The timeout is the whole point. iOS parks a backgrounded context in the
 * non-standard `interrupted` state, and `resume()` on it can return a promise
 * that never settles — not rejects, never settles. A bare `await` on that hangs
 * forever, so neither the caller's catch nor its finally ever runs.
 */
async function resumeToRunning(ctx: AudioContext): Promise<boolean> {
  // Read through a call rather than inline. `ctx.state` is mutated by the audio
  // thread, but TypeScript narrows it at the guard below and carries that
  // narrowing across the await — so a second inline comparison reads as
  // provably false. Each call re-reads at the full declared type.
  const isRunning = () => ctx.state === 'running';

  if (isRunning()) return true;

  const resumed = await Promise.race([
    ctx.resume().then(
      () => true,
      () => false
    ),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), RESUME_TIMEOUT_MS)),
  ]);

  // Resolving is not the same as recovering.
  return resumed && isRunning();
}

export function usePlayback(): UsePlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const rangeRef = useRef<{ start: number; end: number } | null>(null);
  const playStartTimeRef = useRef(0);
  const seekPositionRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const playingRef = useRef(false);
  const frameCountRef = useRef(0);
  const timeListenersRef = useRef<Set<(t: number, d: number) => void>>(new Set());

  const registerTimeListener = useCallback((fn: (t: number, d: number) => void) => {
    timeListenersRef.current.add(fn);
    return () => timeListenersRef.current.delete(fn);
  }, []);

  const getRangeDuration = useCallback(() => {
    if (rangeRef.current) return rangeRef.current.end - rangeRef.current.start;
    return bufferRef.current?.duration ?? 0;
  }, []);

  const stopTimeLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startTimeLoop = useCallback(() => {
    stopTimeLoop();
    frameCountRef.current = 0;
    const tick = () => {
      if (!ctxRef.current || !playingRef.current) return;
      const elapsed =
        ctxRef.current.currentTime - playStartTimeRef.current + seekPositionRef.current;
      const rangeDur = getRangeDuration();
      const clamped = Math.min(elapsed, rangeDur);

      // Hot path: notify DOM listeners every frame — no React re-render
      for (const fn of timeListenersRef.current) fn(clamped, rangeDur);

      // Cold path: throttle React state to ~4fps for caption sync
      frameCountRef.current++;
      if (frameCountRef.current % 15 === 0) {
        setCurrentTime(clamped);
      }

      if (clamped < rangeDur) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        playingRef.current = false;
        setIsPlaying(false);
        setCurrentTime(rangeDur);
        // Reset the seek position so the next play() restarts from the top
        // instead of resuming from a stale pre-play offset.
        seekPositionRef.current = 0;
        for (const fn of timeListenersRef.current) fn(rangeDur, rangeDur);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopTimeLoop, getRangeDuration]);

  const load = useCallback((buffer: AudioBuffer, range?: { start: number; end: number }) => {
    // Stop any active playback before swapping the buffer — otherwise the old
    // AudioBufferSourceNode keeps running while currentTime resets to 0, causing
    // audio/caption desync.
    if (playingRef.current) {
      sourceRef.current?.stop();
      sourceRef.current = null;
      playingRef.current = false;
      stopTimeLoop();
      setIsPlaying(false);
    }

    bufferRef.current = buffer;
    rangeRef.current = range ?? null;
    const dur = range ? range.end - range.start : buffer.duration;
    setDuration(dur);
    setCurrentTime(0);
    seekPositionRef.current = 0;

    // Notify hot-path listeners immediately so the progress bar resets without
    // waiting for the next React render cycle.
    for (const fn of timeListenersRef.current) fn(0, dur);
  }, [stopTimeLoop]);

  const play = useCallback(async () => {
    if (!bufferRef.current || playingRef.current) return;

    // Claim the flag before the first await. This function is async and the
    // guard above runs before it, so two taps in quick succession — exactly
    // what someone does when the button looks dead — could both get through
    // and start overlapping sources, of which only the last is tracked.
    playingRef.current = true;

    try {
      // Synchronous, and deliberately so: on iOS a context has to be created
      // or resumed in the task the tap started. Everything below this point is
      // after an await, so a context built here is the one that inherits the
      // gesture.
      if (!ctxRef.current || ctxRef.current.state === 'closed') {
        ctxRef.current = new AudioContext();
      }
      const ctx = ctxRef.current;

      // Any state other than running, not just 'suspended'. A context that
      // never resumes has a frozen currentTime — the clock every position below
      // is measured against.
      if (!(await resumeToRunning(ctx))) {
        // Retire it. Leaving a wedged context in the ref means every future tap
        // tries to revive the same corpse; dropping it lets the next tap build
        // a fresh one, synchronously, inside its own gesture. Not awaited —
        // close() on an interrupted context can hang the same way resume() does.
        ctxRef.current = null;
        void ctx.close().catch(() => {});
        throw new Error('AudioContext would not resume');
      }

      const source = ctx.createBufferSource();
      source.buffer = bufferRef.current;
      source.connect(ctx.destination);

      const rangeStart = rangeRef.current?.start ?? 0;
      const rangeEnd = rangeRef.current?.end ?? bufferRef.current.duration;
      const rangeDur = rangeEnd - rangeStart;
      const offset = rangeStart + Math.min(seekPositionRef.current, rangeDur);

      source.start(0, offset);
      // Schedule stop at range boundary so playback doesn't bleed past the trim window
      source.stop(ctx.currentTime + (rangeEnd - offset));
      playStartTimeRef.current = ctx.currentTime;

      source.onended = () => {
        // Guard against stale onended from a replaced source (e.g. after seek)
        if (sourceRef.current !== source) return;
        if (playingRef.current) {
          playingRef.current = false;
          setIsPlaying(false);
          seekPositionRef.current = 0;
          setCurrentTime(0);
          stopTimeLoop();
        }
      };

      sourceRef.current = source;
      setIsPlaying(true);
      startTimeLoop();
    } catch (err) {
      // Releasing the flag matters more than the failure itself: leaving it set
      // would make every later play() a silent no-op.
      playingRef.current = false;
      setIsPlaying(false);
      stopTimeLoop();
      console.error('[usePlayback] could not start playback', err);
    }
  }, [startTimeLoop, stopTimeLoop]);

  const pause = useCallback(() => {
    if (!ctxRef.current || !playingRef.current) return;
    seekPositionRef.current =
      ctxRef.current.currentTime - playStartTimeRef.current + seekPositionRef.current;
    sourceRef.current?.stop();
    sourceRef.current = null;
    playingRef.current = false;
    setIsPlaying(false);
    stopTimeLoop();
    // Sync UI to the exact pause position — the time loop throttles React
    // state to ~4fps, so without this the frozen frame can lag the audio.
    const rangeDur = getRangeDuration();
    const paused = Math.min(seekPositionRef.current, rangeDur);
    setCurrentTime(paused);
    for (const fn of timeListenersRef.current) fn(paused, rangeDur);
  }, [stopTimeLoop, getRangeDuration]);

  const seek = useCallback(
    (time: number) => {
      const rangeDur = getRangeDuration();
      const clamped = Math.max(0, Math.min(time, rangeDur));
      seekPositionRef.current = clamped;
      setCurrentTime(clamped);
      for (const fn of timeListenersRef.current) fn(clamped, rangeDur);

      if (playingRef.current) {
        sourceRef.current?.stop();
        sourceRef.current = null;
        playingRef.current = false;
        setIsPlaying(false);
        stopTimeLoop();
        // Scrubbing mid-playback should relocate the playhead, not kill
        // playback — restart from the new position.
        void play();
      }
    },
    [stopTimeLoop, getRangeDuration, play]
  );

  const previewAt = useCallback(
    async (time: number, previewDuration = 1.5) => {
      if (!bufferRef.current) return;

      if (playingRef.current) {
        sourceRef.current?.stop();
        sourceRef.current = null;
        playingRef.current = false;
        stopTimeLoop();
      }

      if (!ctxRef.current || ctxRef.current.state === 'closed') {
        ctxRef.current = new AudioContext();
      }
      const ctx = ctxRef.current;
      if (!(await resumeToRunning(ctx))) {
        // Same retirement as play(). A preview is skippable; leaving a dead
        // context behind for the next real playback is not.
        ctxRef.current = null;
        void ctx.close().catch(() => {});
        return;
      }

      const source = ctx.createBufferSource();
      source.buffer = bufferRef.current;
      source.connect(ctx.destination);

      const rangeStart = rangeRef.current?.start ?? 0;
      const rangeEnd = rangeRef.current?.end ?? bufferRef.current.duration;
      const rangeDur = rangeEnd - rangeStart;
      const clampedTime = Math.max(0, Math.min(time, rangeDur));
      const offset = rangeStart + clampedTime;
      // Stop at whichever comes first: preview window or range end
      const stopAt = ctx.currentTime + Math.min(previewDuration, rangeEnd - offset);

      source.start(0, offset);
      source.stop(stopAt);

      seekPositionRef.current = clampedTime;
      playStartTimeRef.current = ctx.currentTime;
      sourceRef.current = source;
      playingRef.current = true;
      setIsPlaying(true);
      startTimeLoop();

      source.onended = () => {
        if (sourceRef.current !== source) return;
        if (playingRef.current) {
          playingRef.current = false;
          setIsPlaying(false);
          stopTimeLoop();
        }
      };
    },
    [startTimeLoop, stopTimeLoop]
  );

  const stop = useCallback(() => {
    sourceRef.current?.stop();
    sourceRef.current = null;
    playingRef.current = false;
    seekPositionRef.current = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    stopTimeLoop();
  }, [stopTimeLoop]);

  /**
   * Backgrounding the tab suspends the AudioContext and freezes rAF, but tells
   * this hook nothing — so it goes on believing it is playing while the audio
   * is silent and `ctx.currentTime` (the clock every position here is derived
   * from) has stopped advancing. The stale `isPlaying` then sends the user's
   * next tap to pause() instead of play(), which is why the button reads as
   * dead.
   *
   * Pausing on the way out keeps the hook's state honest and banks the exact
   * position. Deliberately no auto-resume on return: restarting audio without
   * a gesture is both jarring and something browsers block anyway.
   *
   * Coming back, the context itself is retired if the OS parked it. Pausing on
   * the way out was never enough on its own — the browser suspends the context
   * whether or not anything was playing, and after a long enough absence iOS
   * moves it to `interrupted`, where it may never resume. Dropping it here is
   * what makes the first tap on return work rather than the second: the next
   * play() finds an empty ref and builds a fresh context synchronously, inside
   * the tap's own gesture.
   *
   * A healthy context is left alone. pause() stops the source node, it does not
   * suspend the context, so anything not `running` here was parked from outside.
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (playingRef.current) pause();
        return;
      }

      const ctx = ctxRef.current;
      if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') {
        ctxRef.current = null;
        void ctx.close().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [pause]);

  useEffect(() => {
    return () => {
      sourceRef.current?.stop();
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        ctxRef.current.close();
      }
      ctxRef.current = null;
      stopTimeLoop();
    };
  }, [stopTimeLoop]);

  return {
    isPlaying,
    currentTime,
    duration,
    play,
    pause,
    seek,
    load,
    stop,
    previewAt,
    registerTimeListener,
  };
}
