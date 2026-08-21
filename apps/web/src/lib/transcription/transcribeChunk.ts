import type { Word } from '@Ordio/shared/schemas';
import { InsufficientCreditsError, transcriptionErrorFor } from './insufficientCredits';

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
    const ext = blob.type.includes('webm') ? 'webm' : 'wav';
    formData.append('audio', blob, `chunk.${ext}`);
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
    return attempt();
  }
}
