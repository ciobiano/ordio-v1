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

    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
    }
    const ctx = ctxRef.current;

    // iOS suspends AudioContext when backgrounded — must resume on user gesture
    if (ctx.state === 'suspended') {
      await ctx.resume();
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
    playingRef.current = true;
    setIsPlaying(true);
    startTimeLoop();
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
  }, [stopTimeLoop]);

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
      }
    },
    [stopTimeLoop, getRangeDuration]
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
      if (ctx.state === 'suspended') await ctx.resume();

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
