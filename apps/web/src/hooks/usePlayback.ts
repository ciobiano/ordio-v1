'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export interface UsePlaybackReturn {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  load: (buffer: AudioBuffer) => void;
  stop: () => void;
}

export function usePlayback(): UsePlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const playStartTimeRef = useRef(0);
  const seekPositionRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const playingRef = useRef(false);

  const stopTimeLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startTimeLoop = useCallback(() => {
    stopTimeLoop();
    const tick = () => {
      if (!ctxRef.current || !playingRef.current) return;
      const elapsed =
        ctxRef.current.currentTime - playStartTimeRef.current + seekPositionRef.current;
      const clamped = Math.min(elapsed, bufferRef.current?.duration ?? 0);
      setCurrentTime(clamped);
      if (clamped < (bufferRef.current?.duration ?? 0)) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setIsPlaying(false);
        playingRef.current = false;
        setCurrentTime(bufferRef.current?.duration ?? 0);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopTimeLoop]);

  const load = useCallback((buffer: AudioBuffer) => {
    bufferRef.current = buffer;
    setDuration(buffer.duration);
    setCurrentTime(0);
    seekPositionRef.current = 0;
  }, []);

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

    const offset = Math.min(seekPositionRef.current, bufferRef.current.duration);
    source.start(0, offset);
    playStartTimeRef.current = ctx.currentTime;

    source.onended = () => {
      // Guard: ignore stale onended from a source that was already replaced
      // (e.g., seek stopped the old source, but onended fires after a new source started)
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
    // Save current position before stopping
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
      const clamped = Math.max(0, Math.min(time, bufferRef.current?.duration ?? 0));
      seekPositionRef.current = clamped;
      setCurrentTime(clamped);

      if (playingRef.current) {
        // Pause at new position — user clicks Play to resume
        sourceRef.current?.stop();
        sourceRef.current = null;
        playingRef.current = false;
        setIsPlaying(false);
        stopTimeLoop();
      }
    },
    [stopTimeLoop]
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

  return { isPlaying, currentTime, duration, play, pause, seek, load, stop };
}
