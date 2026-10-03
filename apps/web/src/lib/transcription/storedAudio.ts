import type { Word } from '@Ordio/shared/schemas';
import { OrdioError, isAbortError } from '@/lib/errors/OrdioError';
import { uploadCodeFor } from '@/lib/errors/classify';
import { transcriptionErrorFor } from './insufficientCredits';

/**
 * Audio reaches Whisper through Convex storage, never through a request body.
 *
 * Vercel refuses any function request body over 4.5MB, and the only way to
 * fit audio under that is to make it worse — the 8kHz squeeze this replaced.
 * Convex upload URLs have no size limit, so the browser uploads there and
 * `/api/transcribe` is sent only the storage ID. Whisper's own 25MB is the
 * one ceiling left.
 */

/** Upload audio to Convex storage and return its storage ID. */
export async function uploadAudio(
  blob: Blob,
  generateUploadUrl: () => Promise<string>,
  signal?: AbortSignal
): Promise<string> {
  let uploadUrl: string;
  try {
    uploadUrl = await generateUploadUrl();
  } catch (err) {
    throw new OrdioError('UPLOAD_URL_FAILED', { cause: err });
  }

  /* The type is stored with the file and is what the route later names it by;
     Whisper decides how to decode from that name. */
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'application/octet-stream' },
    body: blob,
    signal,
  });
  if (!res.ok) {
    throw new OrdioError(uploadCodeFor(res.status), {
      cause: new Error(`Storage upload returned HTTP ${res.status}`),
    });
  }
  try {
    const { storageId } = (await res.json()) as { storageId?: unknown };
    if (typeof storageId !== 'string' || storageId.length === 0) throw new Error('No storageId');
    return storageId;
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new OrdioError('UPLOAD_FAILED', { cause: err });
  }
}

/**
 * Transcribe audio already in storage. `durationSec` sizes the credit hold;
 * the server settles against Whisper's own figure afterwards.
 */
export async function transcribeStoredAudio(
  storageId: string,
  durationSec: number | undefined,
  signal?: AbortSignal
): Promise<Word[]> {
  const declared =
    durationSec !== undefined && Number.isFinite(durationSec) && durationSec > 0
      ? durationSec
      : undefined;
  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storageId, durationSec: declared }),
    signal,
  });
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
}
