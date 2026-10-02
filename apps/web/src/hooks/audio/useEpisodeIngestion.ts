import { useCallback, useMemo, useRef, useState } from 'react';
import type { ClipCandidate, Word } from '@Ordio/shared/schemas';
import { ingestEpisode, EpisodeIngestError } from '@Ordio/engine/media/episodeIngest';
import { isSparseTranscript } from '@Ordio/engine/media/episodePlan';
import { transcribeChunk } from '@/lib/transcription/transcribeChunk';
import { InsufficientCreditsError } from '@/lib/transcription/insufficientCredits';
import { mergeChunkTranscripts } from '@/lib/transcription/mergeChunkTranscripts';
import { fallbackWindows } from '@/lib/clips/fallbackWindows';
import { validateCandidates } from '@/lib/clips/validateCandidates';
import { OrdioError, isAbortError, toOrdioError } from '@/lib/errors/OrdioError';
import type { ErrorCode } from '@/lib/errors/catalog';
import { notifyError } from '@/lib/errors/notify';

const INGEST_CODES: Record<EpisodeIngestError['code'], ErrorCode> = {
  too_long: 'EPISODE_TOO_LONG',
  undecodable: 'EPISODE_UNDECODABLE',
};

type Phase = 'idle' | 'ingesting' | 'transcribing' | 'finding' | 'picking' | 'error';

export interface UseEpisodeIngestionReturn {
  phase: Phase;
  progress: number; // 0–100 across ingest+transcribe
  candidates: ClipCandidate[]; // populated in 'picking'
  episodeFile: File | null; // original file, kept for extractWindow
  episodeWords: Word[]; // merged episode-absolute transcript
  /** Why the run stopped; set whenever `phase` is 'error'. */
  error: OrdioError | null;
  partialAvailable: boolean; // a chunk failed twice; offer partial
  /**
   * The run stopped because the balance ran out, not because anything broke.
   * Callers show the upgrade sheet for this; a retry cannot succeed.
   */
  outOfCredits: boolean;
  startEpisode: (file: File) => Promise<void>;
  usePartialTranscript: () => Promise<void>;
  cancel: () => void; // explicit exit → 'idle' (design rule)
}

/**
 * Orchestrates the long-episode clip-finder pipeline: ingest (stream-decode
 * + chunk + energy) → per-chunk transcribe (with retry/partial-failure
 * handling) → merge transcript → find clips (LLM, with energy fallback) →
 * hand candidates to the picker UI.
 *
 * Pure dependencies (episodePlan, transcribeChunk, mergeChunkTranscripts,
 * fallbackWindows, validateCandidates) are unit-tested elsewhere; this hook
 * is integration-level orchestration exercised via on-device QA and the
 * state-machine-reviewer agent.
 */
export function useEpisodeIngestion(): UseEpisodeIngestionReturn {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [candidates, setCandidates] = useState<ClipCandidate[]>([]);
  const [episodeFile, setEpisodeFile] = useState<File | null>(null);
  const [episodeWords, setEpisodeWords] = useState<Word[]>([]);
  const [error, setError] = useState<OrdioError | null>(null);
  const [partialAvailable, setPartialAvailable] = useState(false);
  const [outOfCredits, setOutOfCredits] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  // In-memory resume state (session-only per design): transcribed chunks survive a failure.
  const transcribedRef = useRef<Array<{ startSec: number; words: Word[] }>>([]);
  const energyRef = useRef<number[]>([]);
  const durationRef = useRef(0);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    transcribedRef.current = [];
    setPhase('idle');
    setProgress(0);
    setCandidates([]);
    setEpisodeFile(null);
    setEpisodeWords([]);
    setOutOfCredits(false);
    setError(null);
    setPartialAvailable(false);
  }, []);

  const findClips = useCallback(async (words: Word[], durationSec: number, signal: AbortSignal) => {
    setPhase('finding');
    if (isSparseTranscript(words.length, durationSec)) {
      setError(new OrdioError('EPISODE_NO_SPEECH'));
      setPhase('error');
      return;
    }
    let found: ClipCandidate[] = [];
    try {
      const res = await fetch('/api/find-clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words, durationSec }),
        signal,
      });
      if (res.ok) {
        const { candidates: raw } = (await res.json()) as { candidates: unknown };
        found = validateCandidates(raw, durationSec);
      }
    } catch (err) {
      if (isAbortError(err)) throw err;
      // fall through to energy fallback
      console.warn('[useEpisodeIngestion] find-clips failed; using energy fallback', err);
    }
    if (found.length === 0) {
      found = fallbackWindows(energyRef.current, durationSec);
      if (found.length > 0) notifyError(new OrdioError('CLIPS_AI_UNAVAILABLE'));
    }
    if (found.length === 0) {
      setError(new OrdioError('EPISODE_NO_CLIPS'));
      setPhase('error');
      return;
    }
    setEpisodeWords(words);
    setCandidates(found);
    setPhase('picking');
  }, []);

  const startEpisode = useCallback(async (file: File) => {
    const abort = new AbortController();
    abortRef.current = abort;
    setEpisodeFile(file);
    setError(null);
    setPartialAvailable(false);
    setOutOfCredits(false);
    transcribedRef.current = [];
    try {
      // Phase 1: ingest (0–40%)
      setPhase('ingesting');
      setProgress(0);
      const result = await ingestEpisode(file, {
        signal: abort.signal,
        onProgress: (f) => setProgress(Math.round(f * 40)),
      });
      energyRef.current = result.energy;
      durationRef.current = result.durationSec;

      // Phase 2: per-chunk transcription (40–90%)
      setPhase('transcribing');
      for (let i = 0; i < result.chunks.length; i++) {
        const chunk = result.chunks[i]!;
        try {
          const words = await transcribeChunk(chunk.blob, abort.signal, chunk.durationSec);
          transcribedRef.current.push({ startSec: chunk.startSec, words });
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') throw err;
          /* Out of credits is not a chunk that failed — it is the pipeline
             hitting the spend cap, and every remaining chunk would be refused
             identically, so the loop stops here rather than grinding through
             the rest. Whatever already transcribed was paid for and is still
             offered as a partial, on the same principle as a failed chunk. */
          if (err instanceof InsufficientCreditsError) {
            setOutOfCredits(true);
            if (transcribedRef.current.length > 0) {
              setPartialAvailable(true);
              setError(new OrdioError('EPISODE_CREDITS_RAN_OUT', { cause: err }));
              setPhase('error');
              return;
            }
            throw err;
          }
          // Chunk failed twice (transcribeChunk retries internally). Per design:
          // never silently discard already-spent upload data — offer partial.
          if (transcribedRef.current.length > 0) {
            setPartialAvailable(true);
            /* Kept as the cause: the log line says which failure it was, the
               dialog says what is still possible. */
            console.error('[useEpisodeIngestion] chunk failed', err);
            setError(new OrdioError('EPISODE_PARTIAL_TRANSCRIPT', { cause: err }));
            setPhase('error');
            return;
          }
          throw err;
        }
        setProgress(40 + Math.round(((i + 1) / result.chunks.length) * 50));
      }

      // Phase 3: clip finding (90–100%)
      const merged = mergeChunkTranscripts(transcribedRef.current);
      setProgress(95);
      await findClips(merged, result.durationSec, abort.signal);
      setProgress(100);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (abortRef.current !== abort) return;
        cancel();
        return;
      }
      /* A failed chunk keeps its own name — "Transcription timed out", "You
         are offline" — rather than collapsing into "Episode processing
         failed", which told the person nothing they could act on. */
      const failure =
        err instanceof EpisodeIngestError
          ? new OrdioError(INGEST_CODES[err.code], { message: err.message, cause: err })
          : toOrdioError(err, 'EPISODE_FAILED');
      console.error(`[useEpisodeIngestion] ${failure.code}`, err);
      setError(failure);
      setPhase('error');
    } finally {
      if (abortRef.current === abort) abortRef.current = null;
    }
  }, [cancel, findClips]);

  const usePartialTranscript = useCallback(async () => {
    const merged = mergeChunkTranscripts(transcribedRef.current);
    const abort = new AbortController();
    abortRef.current = abort;
    setError(null);
    setPartialAvailable(false);
    try {
      await findClips(merged, durationRef.current, abort.signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (abortRef.current !== abort) return;
        cancel();
        return;
      }
      setError(toOrdioError(err, 'EPISODE_FAILED'));
      setPhase('error');
    } finally {
      if (abortRef.current === abort) abortRef.current = null;
    }
  }, [cancel, findClips]);

  return useMemo(
    () => ({
      phase, progress, candidates, episodeFile, episodeWords, error, partialAvailable,
      outOfCredits, startEpisode, usePartialTranscript, cancel,
    }),
    [phase, progress, candidates, episodeFile, episodeWords, error, partialAvailable,
      outOfCredits, startEpisode, usePartialTranscript, cancel]
  );
}
