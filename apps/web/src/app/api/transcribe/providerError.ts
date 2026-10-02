import OpenAI from 'openai';
import type { ErrorCode } from '@/lib/errors/catalog';

/** HTTP status the route answers with for each failure it can name. */
export const STATUS_FOR: Partial<Record<ErrorCode, number>> = {
  AUTH_REQUIRED: 401,
  TRANSCRIBE_BAD_REQUEST: 400,
  INSUFFICIENT_CREDITS: 402,
  TRANSCRIBE_FILE_TOO_LARGE: 413,
  TRANSCRIBE_AUDIO_REJECTED: 422,
  TRANSCRIBE_RATE_LIMITED: 429,
  TRANSCRIBE_FAILED: 500,
  TRANSCRIBE_PROVIDER_BUSY: 502,
  TRANSCRIBE_PROVIDER_UNREACHABLE: 502,
  CREDITS_CHECK_FAILED: 503,
  TRANSCRIBE_UNAVAILABLE: 503,
  TRANSCRIBE_TIMEOUT: 504,
};

/**
 * Name a failure thrown while calling Whisper.
 *
 * The split that matters is whose fault it is. A 400 means OpenAI could not
 * read this audio — the person can convert the file. A 429 or 5xx means OpenAI
 * is struggling — waiting helps. A bad key or an exhausted org quota is ours —
 * nothing the person does will help, so it reads as "unavailable", never as a
 * rate limit they might think they caused.
 */
export function providerErrorCode(err: unknown): ErrorCode {
  if (err instanceof OpenAI.APIConnectionTimeoutError) return 'TRANSCRIBE_TIMEOUT';
  if (err instanceof OpenAI.APIConnectionError) return 'TRANSCRIBE_PROVIDER_UNREACHABLE';
  if (err instanceof OpenAI.APIError) {
    if (err.code === 'insufficient_quota') return 'TRANSCRIBE_UNAVAILABLE';
    const status = err.status ?? 0;
    if (status === 401 || status === 403 || status === 404) return 'TRANSCRIBE_UNAVAILABLE';
    if (status === 400 || status === 415 || status === 422) return 'TRANSCRIBE_AUDIO_REJECTED';
    if (status === 413) return 'TRANSCRIBE_FILE_TOO_LARGE';
    if (status === 429 || status >= 500) return 'TRANSCRIBE_PROVIDER_BUSY';
  }
  if (err instanceof Error && err.message.includes('OPENAI_API_KEY')) return 'TRANSCRIBE_UNAVAILABLE';
  return 'TRANSCRIBE_FAILED';
}
