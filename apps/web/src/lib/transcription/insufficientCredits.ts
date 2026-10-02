import { OrdioError } from '@/lib/errors/OrdioError';
import { transcribeCodeFor } from '@/lib/errors/classify';

/**
 * The out-of-credits failure, distinguished from every other transcription
 * failure.
 *
 * Running out of credits is not an error in the usual sense — nothing broke,
 * and retrying will not help. It is the one failure whose correct response is
 * an upgrade prompt rather than "try again", so callers need to be able to tell
 * it apart from a network blip or a bad file without string-matching a message.
 */
export class InsufficientCreditsError extends OrdioError {
  /** Minutes the user has left. Zero in the ordinary case. */
  readonly minutesRemaining: number;

  constructor(minutesRemaining: number) {
    super('INSUFFICIENT_CREDITS', { message: 'Out of transcription credits' });
    this.name = 'InsufficientCreditsError';
    this.minutesRemaining = minutesRemaining;
  }
}

/** The status the transcribe route returns when a hold cannot be covered. */
export const INSUFFICIENT_CREDITS_STATUS = 402;

/** The machine-readable marker on that response body. */
export const INSUFFICIENT_CREDITS_CODE = 'INSUFFICIENT_CREDITS';

/**
 * Build the right error for a failed transcription response.
 *
 * Checks the status as well as the code so a proxy returning a bare 402 without
 * our body still lands on the upgrade path rather than on a confusing generic
 * message. Every other failure keeps the name the route gave it, so the toast
 * can say "Transcription timed out" rather than "Transcription failed".
 */
export function transcriptionErrorFor(status: number, body: unknown): OrdioError {
  const record = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;

  if (status === INSUFFICIENT_CREDITS_STATUS || record.code === INSUFFICIENT_CREDITS_CODE) {
    const minutes = typeof record.minutes === 'number' ? record.minutes : 0;
    return new InsufficientCreditsError(minutes);
  }

  const message = typeof record.error === 'string' ? record.error : `Transcription failed (${status})`;
  return new OrdioError(transcribeCodeFor(status, body), { message });
}
