// hooks/recording/useLiveTranscription.ts
// React lifecycle glue for live captions during recording. Owns a
// LiveTranscriber instance, translates its event stream into render-ready
// caption state, and guarantees the recording flow never blocks on it —
// every failure path degrades to "no captions" (today's status quo).
'use client';

import { useCallback, useReducer, useRef, useState } from 'react';
import { OpenAILiveTranscriber } from '@/lib/liveTranscription/openaiLiveTranscriber';
import type { LiveTranscriber } from '@/lib/liveTranscription/types';

export interface CaptionState {
  /** Finished utterances, in order. Rendered as committed caption lines. */
  committedLines: string[];
  /** Text of in-progress utterances, keyed by the vendor's item id. */
  interimByItem: Record<string, string>;
}

export type CaptionAction =
  | { type: 'partial'; itemId: string; delta: string }
  | { type: 'final'; itemId: string; text: string }
  | { type: 'reset' };

const INITIAL_STATE: CaptionState = { committedLines: [], interimByItem: {} };

function captionReducer(state: CaptionState, action: CaptionAction): CaptionState {
  switch (action.type) {
    case 'partial':
      return {
        ...state,
        interimByItem: {
          ...state.interimByItem,
          [action.itemId]: (state.interimByItem[action.itemId] ?? '') + action.delta,
        },
      };
    case 'final': {
      const { [action.itemId]: _finished, ...remainingInterim } = state.interimByItem;
      const trimmed = action.text.trim();
      return {
        committedLines: trimmed ? [...state.committedLines, trimmed] : state.committedLines,
        interimByItem: remainingInterim,
      };
    }
    case 'reset':
      return INITIAL_STATE;
  }
}

export interface UseLiveTranscriptionReturn {
  /** Committed caption lines plus current interim text, ready to render. */
  committedLines: string[];
  interimText: string;
  liveError: string | null;
  startLive: (stream: MediaStream) => void;
  stopLive: () => void;
  /** Mirror recording pause/resume so paused speech is never captioned. */
  setLiveSuspended: (suspended: boolean) => void;
  resetCaptions: () => void;
}

export function useLiveTranscription(): UseLiveTranscriptionReturn {
  const [state, dispatch] = useReducer(captionReducer, INITIAL_STATE);
  const [liveError, setLiveError] = useState<string | null>(null);
  const transcriberRef = useRef<LiveTranscriber | null>(null);

  const stopLive = useCallback(() => {
    transcriberRef.current?.stop();
    transcriberRef.current = null;
  }, []);

  const startLive = useCallback(
    (stream: MediaStream) => {
      stopLive();
      setLiveError(null);

      const transcriber = new OpenAILiveTranscriber();
      transcriber.onPartial(({ itemId, delta }) => dispatch({ type: 'partial', itemId, delta }));
      transcriber.onFinal(({ itemId, text }) => dispatch({ type: 'final', itemId, text }));
      transcriber.onError((message) => setLiveError(message));
      transcriberRef.current = transcriber;

      // Fire-and-forget by design: recording must never wait on captions.
      transcriber.start(stream).catch((err: unknown) => {
        setLiveError(err instanceof Error ? err.message : 'Live captions unavailable');
        transcriberRef.current = null;
      });
    },
    [stopLive]
  );

  const setLiveSuspended = useCallback((suspended: boolean) => {
    transcriberRef.current?.setSuspended(suspended);
  }, []);

  const resetCaptions = useCallback(() => {
    dispatch({ type: 'reset' });
    setLiveError(null);
  }, []);

  return {
    committedLines: state.committedLines,
    interimText: Object.values(state.interimByItem).join(' '),
    liveError,
    startLive,
    stopLive,
    setLiveSuspended,
    resetCaptions,
  };
}
