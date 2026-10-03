import type { Word } from '@Ordio/shared/schemas';
import { InsufficientCreditsError } from './insufficientCredits';
import { transcribeStoredAudio } from './storedAudio';
import { OrdioError } from '@/lib/errors/OrdioError';
import type { ErrorCode } from '@/lib/errors/catalog';

/** Failures a second identical request would meet identically. */
const NOT_RETRYABLE = new Set<ErrorCode>([
  'AUTH_REQUIRED',
  'TRANSCRIBE_RATE_LIMITED',
  'TRANSCRIBE_FILE_TOO_LARGE',
  'TRANSCRIBE_BAD_REQUEST',
  'TRANSCRIBE_AUDIO_REJECTED',
]);

/**
 * Transcribe one Episode chunk that is already in storage, by its ID.
 * Retries once on failure (network or 5xx); aborts propagate immediately.
 *
 * `durationSec` sizes the credit hold. Omitting it does not make the chunk
 * free — the server settles against Whisper's own duration afterwards — it
 * makes the hold the one-credit floor, so the balance check passes on a
 * balance that cannot remotely cover the work, and the settle then takes the
 * full price anyway. Across the dozens of chunks in an episode that walks the
 * balance far below zero, and every later transcription is refused until it is
 * square again. Declaring the length is what lets the pipeline stop at the
 * chunk it can no longer afford instead of overdrawing past all of them.
 */
export async function transcribeChunk(
  storageId: string,
  signal: AbortSignal,
  durationSec?: number
): Promise<Word[]> {
  const attempt = () => transcribeStoredAudio(storageId, durationSec, signal);

  try {
    return await attempt();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    /* Running out of credits is not a transient fault. Retrying it costs a
       second round-trip to be refused identically, and buries the one error
       the caller needs to tell apart from a network blip. */
    if (err instanceof InsufficientCreditsError) throw err;
    if (err instanceof OrdioError && NOT_RETRYABLE.has(err.code)) throw err;
    return attempt();
  }
}
