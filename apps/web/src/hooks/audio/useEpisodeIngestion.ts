import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ClipCandidate, Word } from '@Ordio/shared/schemas';
import { ingestEpisode, EpisodeIngestError } from '@/lib/media/episodeIngest';
import { isSparseTranscript } from '@/lib/media/episodePlan';
import { transcribeChunk } from '@/lib/transcription/transcribeChunk';
import { mergeChunkTranscripts } from '@/lib/transcription/mergeChunkTranscripts';
import { fallbackWindows } from '@/lib/clips/fallbackWindows';
import { validateCandidates } from '@/lib/clips/validateCandidates';

type Phase = 'idle' | 'ingesting' | 'transcribing' | 'finding' | 'picking' | 'error';

export interface UseEpisodeIngestionReturn {
  phase: Phase;
  progress: number; // 0–100 across ingest+transcribe
  candidates: ClipCandidate[]; // populated in 'picking'
  episodeFile: File | null; // original file, kept for extractWindow
  episodeWords: Word[]; // merged episode-absolute transcript
  error: string | null;
  partialAvailable: boolean; // a chunk failed twice; offer partial
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
  const [error, setError] = useState<string | null>(null);
  const [partialAvailable, setPartialAvailable] = useState(false);

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
    setError(null);
    setPartialAvailable(false);
  }, []);

  const findClips = useCallback(async (words: Word[], durationSec: number, signal: AbortSignal) => {
    setPhase('finding');
    if (isSparseTranscript(words.length, durationSec)) {
      setError("We couldn't find enough speech in this episode to suggest clips. Music-heavy or mostly instrumental episodes aren't supported yet.");
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
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      // fall through to energy fallback
    }
    if (found.length === 0) {
      found = fallbackWindows(energyRef.current, durationSec);
      if (found.length > 0) toast.info('AI clip selection was unavailable — showing high-energy moments instead.');
    }
    if (found.length === 0) {
      setError('No clip candidates could be generated for this episode.');
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
          const words = await transcribeChunk(chunk.blob, abort.signal);
          transcribedRef.current.push({ startSec: chunk.startSec, words });
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') throw err;
          // Chunk failed twice (transcribeChunk retries internally). Per design:
          // never silently discard already-spent upload data — offer partial.
          if (transcribedRef.current.length > 0) {
            setPartialAvailable(true);
            setError('Part of the episode could not be transcribed.');
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
      const message =
        err instanceof EpisodeIngestError
          ? err.message
          : 'Episode processing failed. Please try again.';
      console.error('[useEpisodeIngestion]', err);
      setError(message);
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
      setError('Clip finding failed.');
      setPhase('error');
    } finally {
      if (abortRef.current === abort) abortRef.current = null;
    }
  }, [cancel, findClips]);

  return useMemo(
    () => ({
      phase, progress, candidates, episodeFile, episodeWords, error, partialAvailable,
      startEpisode, usePartialTranscript, cancel,
    }),
    [phase, progress, candidates, episodeFile, episodeWords, error, partialAvailable,
      startEpisode, usePartialTranscript, cancel]
  );
}
