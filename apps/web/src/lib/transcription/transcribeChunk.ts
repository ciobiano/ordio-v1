import type { Word } from '@Ordio/shared/schemas';
import { InsufficientCreditsError, transcriptionErrorFor } from './insufficientCredits';
import { OrdioError } from '@/lib/errors/OrdioError';
import type { ErrorCode } from '@/lib/errors/catalog';

/**
 * The route trusts the filename's extension over the MIME type when it tells
 * Whisper what format the bytes are, so the extension must match the encoding:
 * MP3 bytes named `.wav` would reach Whisper labelled as WAV.
 */
function chunkExtension(blob: Blob): string {
  if (blob.type.includes('mpeg')) return 'mp3';
  if (blob.type.includes('wav')) return 'wav';
  return 'webm';
}

/** Failures a second identical request would meet identically. */
const NOT_RETRYABLE = new Set<ErrorCode>([
  'AUTH_REQUIRED',
  'TRANSCRIBE_RATE_LIMITED',
  'TRANSCRIBE_FILE_TOO_LARGE',
  'TRANSCRIBE_BAD_REQUEST',
  'TRANSCRIBE_AUDIO_REJECTED',
]);

/**
 * POST one episode chunk to the existing stateless /api/transcribe route.
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
  blob: Blob,
  signal: AbortSignal,
  durationSec?: number
): Promise<Word[]> {
  const attempt = async (): Promise<Word[]> => {
    const formData = new FormData();
    formData.append('audio', blob, `chunk.${chunkExtension(blob)}`);
    if (durationSec !== undefined && Number.isFinite(durationSec) && durationSec > 0) {
      formData.append('durationSec', String(durationSec));
    }
    const res = await fetch('/api/transcribe', { method: 'POST', body: formData, signal });
    if (!res.ok) {
      /* A proxy or edge failure returns HTML, not JSON, so the body is read
         defensively — the status alone is enough to classify the failure. */
      let body: unknown = {};
      try {
        body = await res.json();
      } catch {
        body = {};
      }
      throw transcriptionErrorFor(res.status, body);
    }
    const { words } = (await res.json()) as { words: Word[] };
    return words;
  };

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
