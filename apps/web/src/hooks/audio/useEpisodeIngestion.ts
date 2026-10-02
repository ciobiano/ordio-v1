import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ClipCandidate, Word } from '@Ordio/shared/schemas';
import { openEpisode, EpisodeIngestError } from '@Ordio/engine/media/episodeIngest';
import { isSparseTranscript } from '@Ordio/engine/media/episodePlan';
import { transcribeChunk } from '@/lib/transcription/transcribeChunk';
import { InsufficientCreditsError } from '@/lib/transcription/insufficientCredits';
import { mergeChunkTranscripts } from '@/lib/transcription/mergeChunkTranscripts';
import { poolMap } from '@/lib/transcription/poolMap';
import { fallbackWindows } from '@/lib/clips/fallbackWindows';
import { snapCandidates } from '@/lib/clips/snapCandidates';
import { insideSpans, maskToSpans, transcribedSpans, type Span } from '@/lib/clips/transcribedSpans';
import { validateCandidates } from '@/lib/clips/validateCandidates';

type Phase = 'idle' | 'ingesting' | 'transcribing' | 'finding' | 'picking' | 'error';

/**
 * Chunks uploaded at once. Every chunk is still its own request, so this
 * changes how fast an Episode is read, not how much of the 15-an-hour
 * `/api/transcribe` allowance it uses or what it costs.
 */
const TRANSCRIBE_CONCURRENCY = 3;

const isAbortError = (err: unknown) => err instanceof DOMException && err.name === 'AbortError';

type TranscribedChunk = { startSec: number; durationSec: number; words: Word[] };

export interface UseEpisodeIngestionReturn {
  phase: Phase;
  progress: number; // 0–100; decode and transcription overlap, so both feed it
  candidates: ClipCandidate[]; // populated in 'picking'
  episodeFile: File | null; // original file, kept for extractWindow
  episodeWords: Word[]; // merged episode-absolute transcript
  error: string | null;
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
 * Orchestrates the long-episode clip-finder pipeline: stream-decode the
 * Episode into pause-aligned chunks, uploading each for transcription as soon
 * as it is ready (up to TRANSCRIBE_CONCURRENCY at once, with retry and
 * partial-failure handling) → merge transcript → find clips (LLM, with energy
 * fallback) → snap them onto sentence boundaries → hand candidates to the
 * picker UI.
 *
 * Pure dependencies (episodePlan, transcribeChunk, poolMap,
 * mergeChunkTranscripts, fallbackWindows, snapCandidates, validateCandidates)
 * are unit-tested elsewhere; this hook
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
  const [outOfCredits, setOutOfCredits] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  // In-memory resume state (session-only per design): transcribed chunks survive a failure.
  const transcribedRef = useRef<TranscribedChunk[]>([]);
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

  /* Leaving the screen mid-run stops it. Without this the uploads carry on,
     three at a time, spending credits on Clips nobody will see. */
  useEffect(() => () => abortRef.current?.abort(), []);

  const findClips = useCallback(async (
    words: Word[],
    durationSec: number,
    covered: Span[],
    signal: AbortSignal
  ) => {
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
        found = validateCandidates(raw, durationSec).filter((c) => insideSpans(c, covered));
      }
    } catch (err) {
      if (isAbortError(err)) throw err;
      // fall through to energy fallback
    }
    if (found.length === 0) {
      found = fallbackWindows(maskToSpans(energyRef.current, covered), durationSec).filter((c) =>
        insideSpans(c, covered)
      );
      if (found.length > 0) toast.info('AI clip selection was unavailable — showing high-energy moments instead.');
    }
    // Re-validated because snapping two neighbours can make them touch.
    found = validateCandidates(snapCandidates(found, words, durationSec), durationSec);
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
    // Never two pipelines at once — a second start would double the uploads in flight.
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setEpisodeFile(file);
    setError(null);
    setPartialAvailable(false);
    setOutOfCredits(false);
    /* A local list, published through the ref, rather than pushing into the
       ref itself: a run superseded by cancel-and-restart may still have an
       upload settling, and it must land in its own list, not the new run's. */
    const transcribed: TranscribedChunk[] = [];
    /* Kept apart from the pool's failure, which is whichever error came first.
       With uploads in flight together, a network failure can land just ahead
       of the credit refusal, and the person would be shown a retry for a
       problem only more credits can solve. */
    let creditError: InsufficientCreditsError | null = null;
    transcribedRef.current = transcribed;
    /* Decoding and transcription overlap, so neither owns a band of the bar.
       Decoding is the quick part and transcription the slow one; the weights
       keep the bar moving at roughly the pace the wait actually passes. */
    let decodedFraction = 0;
    let transcribedSec = 0;
    const report = () => {
      const total = durationRef.current;
      const transcribedFraction = total > 0 ? Math.min(1, transcribedSec / total) : 0;
      setProgress(Math.round(20 * decodedFraction + 70 * transcribedFraction));
    };
    try {
      setPhase('ingesting');
      setProgress(0);
      const episode = await openEpisode(file, {
        signal: abort.signal,
        onProgress: (f) => {
          decodedFraction = f;
          report();
        },
      });
      // Opening isn't abortable; a cancelled run must not publish its duration.
      if (abort.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      durationRef.current = episode.durationSec;

      const { failure } = await poolMap(
        episode.chunks,
        async (chunk) => {
          setPhase('transcribing');
          try {
            const words = await transcribeChunk(chunk.blob, abort.signal, chunk.durationSec);
            return { startSec: chunk.startSec, durationSec: chunk.durationSec, words };
          } catch (err) {
            if (err instanceof InsufficientCreditsError) creditError ??= err;
            throw err;
          }
        },
        TRANSCRIBE_CONCURRENCY,
        (result) => {
          transcribed.push(result);
          transcribedSec += result.durationSec;
          report();
        }
      );
      /* The pool waits for in-flight uploads before returning, and the person
         may cancel during that wait. The failure it reports would then be
         whatever broke first, not the abort — and acting on it would put an
         error sheet over the idle screen they just cancelled back to. */
      if (abort.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      energyRef.current = episode.energy();

      if (failure) {
        const err = creditError ?? failure.error;
        if (isAbortError(err)) throw err;
        /* Out of credits is not a chunk that failed — it is the pipeline
           hitting the spend cap, and every remaining chunk would be refused
           identically, so no new chunk starts after it. Whatever already
           transcribed — including uploads that were in flight when it
           happened — was paid for and is offered as a partial, on the same
           principle as a failed chunk. */
        if (err instanceof InsufficientCreditsError) setOutOfCredits(true);
        // A chunk failed twice (transcribeChunk retries internally), or decoding
        // broke midway. Per design: never silently discard spent work — offer partial.
        if (transcribed.length > 0) {
          setPartialAvailable(true);
          setError(
            err instanceof InsufficientCreditsError
              ? 'You ran out of credits partway through this episode.'
              : 'Part of the episode could not be transcribed.'
          );
          setPhase('error');
          return;
        }
        throw err;
      }

      const merged = mergeChunkTranscripts(transcribed);
      setProgress(95);
      await findClips(merged, episode.durationSec, transcribedSpans(transcribed), abort.signal);
      setProgress(100);
    } catch (err) {
      if (isAbortError(err)) {
        if (abortRef.current !== abort) return;
        cancel();
        return;
      }
      const message =
        err instanceof InsufficientCreditsError
          ? 'You are out of transcription credits.'
          : err instanceof EpisodeIngestError
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
    const covered = transcribedSpans(transcribedRef.current);
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setError(null);
    setPartialAvailable(false);
    try {
      await findClips(merged, durationRef.current, covered, abort.signal);
    } catch (err) {
      if (isAbortError(err)) {
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
      outOfCredits, startEpisode, usePartialTranscript, cancel,
    }),
    [phase, progress, candidates, episodeFile, episodeWords, error, partialAvailable,
      outOfCredits, startEpisode, usePartialTranscript, cancel]
  );
}
