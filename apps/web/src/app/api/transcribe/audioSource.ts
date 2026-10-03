import { z } from 'zod';

/** Whisper's own upload limit. Nothing larger can be transcribed. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/**
 * What a transcription request names as its audio.
 *
 * `stored` is the path every current client takes: the audio is already in
 * Convex storage, and the request carries only its ID. Vercel refuses request
 * bodies over 4.5MB, so audio never travels through this route's body.
 *
 * `inline` is the old multipart upload, kept for one deploy so a tab opened
 * before it does not break mid-session. Remove it in the deploy after.
 */
export type AudioSource =
  | { kind: 'stored'; storageId: string; declaredSeconds: number }
  | { kind: 'inline'; file: Blob; declaredSeconds: number };

const StoredRequestSchema = z.object({
  storageId: z.string().min(1).max(200),
  durationSec: z.number().positive().finite().optional(),
});

/**
 * Read the caller's declared audio length.
 *
 * Only ever used to size the credit hold — the settle step reconciles against
 * Whisper's reported duration, so a caller who under-reports gains one
 * transcription and a negative balance, not free service.
 */
function parseDeclaredDuration(value: FormDataEntryValue | null): number {
  if (typeof value !== 'string') return 0;
  const seconds = Number.parseFloat(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

/** The request's audio source, or null when the body names none. */
export async function readAudioSource(request: Request): Promise<AudioSource | null> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const parsed = StoredRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return null;
    return {
      kind: 'stored',
      storageId: parsed.data.storageId,
      declaredSeconds: parsed.data.durationSec ?? 0,
    };
  }

  /* A body that is not multipart at all (or was cut off in transit) throws
     here, and is the caller's request being malformed, not Whisper failing. */
  const formData = await request.formData().catch(() => null);
  const file = formData?.get('audio');
  if (!formData || !file || !(file instanceof Blob) || file.size === 0) return null;
  return { kind: 'inline', file, declaredSeconds: parseDeclaredDuration(formData.get('durationSec')) };
}

export class StoredAudioError extends Error {
  constructor(readonly reason: 'too_large' | 'unreadable', message: string) {
    super(message);
    this.name = 'StoredAudioError';
  }
}

/**
 * Fetch a stored file through its signed URL, refusing anything Whisper
 * could not take. The declared length is checked before the body is read, so
 * an oversized file is never pulled into memory.
 */
export async function downloadStoredAudio(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new StoredAudioError('unreadable', `Storage returned HTTP ${res.status}`);

  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_AUDIO_BYTES) {
    throw new StoredAudioError('too_large', `Stored file is ${declared} bytes`);
  }

  const type = res.headers.get('content-type') ?? '';
  const blob = new Blob([await res.arrayBuffer()], { type });
  if (blob.size === 0) throw new StoredAudioError('unreadable', 'Stored file is empty');
  if (blob.size > MAX_AUDIO_BYTES) {
    throw new StoredAudioError('too_large', `Stored file is ${blob.size} bytes`);
  }
  return blob;
}
