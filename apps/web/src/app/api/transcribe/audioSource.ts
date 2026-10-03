import { z } from 'zod';

/** Whisper's own upload limit. Nothing larger can be transcribed. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/**
 * The audio a transcription request names: a file already in Convex storage,
 * by its ID. Audio never travels in this route's body — Vercel refuses request
 * bodies over 4.5MB, and fitting under that meant making the audio worse.
 */
export interface AudioSource {
  storageId: string;
  /**
   * The caller's declared length, in seconds. Only ever used to size the
   * credit hold — the settle step reconciles against Whisper's reported
   * duration, so a caller who under-reports gains one transcription and a
   * negative balance, not free service.
   */
  declaredSeconds: number;
}

const RequestSchema = z.object({
  storageId: z.string().min(1).max(200),
  durationSec: z.number().positive().finite().optional(),
});

/**
 * The request's audio source, or null when the body doesn't name one. A
 * multipart upload — what clients sent before audio moved to storage — reads
 * as malformed, and the caller is asked to try again (a reload fixes a tab
 * still running the old client).
 */
export async function readAudioSource(request: Request): Promise<AudioSource | null> {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return null;
  return { storageId: parsed.data.storageId, declaredSeconds: parsed.data.durationSec ?? 0 };
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
