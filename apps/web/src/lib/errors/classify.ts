/**
 * Translators from the shapes failures arrive in — a DOMException name, an HTTP
 * status, an engine reason — to a catalog code. Each one is the single place
 * that shape is interpreted.
 */
import type { MediaDecodeErrorCode } from '@Ordio/engine/media';
import { isErrorCode, type ErrorCode } from './catalog';
import { OrdioError } from './OrdioError';

/**
 * `getUserMedia` and `new MediaRecorder` report failures by DOMException name.
 * Reading the message instead is what made a missing microphone and a refused
 * one look the same.
 */
export function classifyMicError(err: unknown): ErrorCode {
  if (typeof navigator !== 'undefined' && !navigator.mediaDevices?.getUserMedia) {
    return 'MIC_INSECURE_CONTEXT';
  }
  if (typeof MediaRecorder === 'undefined') return 'RECORDING_UNSUPPORTED';
  /* Read off any object: a DOMException is not an `Error` in every engine,
     and an `instanceof` check here silently sent every refusal to the
     generic branch. */
  const name =
    typeof err === 'object' && err !== null && 'name' in err ? String((err as { name: unknown }).name) : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'MIC_PERMISSION_DENIED';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'MIC_NOT_FOUND';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'MIC_IN_USE';
    case 'NotSupportedError':
      return 'RECORDING_UNSUPPORTED';
    default:
      return 'MIC_START_FAILED';
  }
}

/**
 * The code for a failed `/api/transcribe` response.
 *
 * The route names its failures in `body.code`; that wins. The status is the
 * fallback for responses that never reached the route — a platform 413 for an
 * oversized body, a 504 when the function ran out of time — which arrive as
 * HTML with no code at all.
 */
export function transcribeCodeFor(status: number, body: unknown): ErrorCode {
  const code = (typeof body === 'object' && body !== null ? (body as Record<string, unknown>).code : undefined);
  if (isErrorCode(code)) return code;
  if (status === 401 || status === 403) return 'AUTH_REQUIRED';
  if (status === 402) return 'INSUFFICIENT_CREDITS';
  if (status === 413) return 'TRANSCRIBE_FILE_TOO_LARGE';
  if (status === 429) return 'TRANSCRIBE_RATE_LIMITED';
  if (status === 503) return 'TRANSCRIBE_UNAVAILABLE';
  if (status === 504) return 'TRANSCRIBE_TIMEOUT';
  if (status === 400) return 'TRANSCRIBE_BAD_REQUEST';
  return 'TRANSCRIBE_FAILED';
}

const DECODE_CODES: Record<MediaDecodeErrorCode, ErrorCode> = {
  empty: 'AUDIO_EMPTY',
  no_audio_track: 'AUDIO_NO_TRACK',
  codec_unsupported: 'AUDIO_CODEC_UNSUPPORTED',
  unreadable: 'AUDIO_DECODE_FAILED',
};

/**
 * Code for a failed decode. Matched by name rather than `instanceof` so it
 * holds across bundle boundaries and module mocks; anything that is not the
 * engine's typed decode error is a file Ordio could not read.
 */
export function decodeCodeFor(err: unknown): ErrorCode {
  if (err instanceof Error && err.name === 'MediaDecodeError' && 'code' in err) {
    return DECODE_CODES[err.code as MediaDecodeErrorCode] ?? 'AUDIO_DECODE_FAILED';
  }
  return 'AUDIO_DECODE_FAILED';
}

/** Code for a failed upload to Convex storage, by HTTP status. */
export function uploadCodeFor(status: number): ErrorCode {
  if (status === 413) return 'FILE_TOO_LARGE';
  if (status === 401 || status === 403) return 'AUTH_REQUIRED';
  return 'UPLOAD_FAILED';
}

/** Code for a failed `/api/direct` response, by HTTP status. */
export function directorCodeFor(status: number): ErrorCode {
  if (status === 401 || status === 403) return 'AUTH_REQUIRED';
  if (status === 429) return 'DIRECTOR_RATE_LIMITED';
  if (status === 502) return 'DIRECTOR_NO_LOOKS';
  if (status === 503) return 'DIRECTOR_UNAVAILABLE';
  return 'DIRECTOR_FAILED';
}

/**
 * Code for a failed background upload. The transcoder throws plain errors;
 * these are the two the person can do something about.
 */
export function backgroundCodeFor(err: unknown): ErrorCode {
  if (err instanceof OrdioError) return err.code;
  const message = err instanceof Error ? err.message : '';
  if (/no playable video/i.test(message)) return 'BACKGROUND_NO_VIDEO';
  if (/cannot be converted|cannot decode/i.test(message)) return 'BACKGROUND_CONVERT_UNSUPPORTED';
  return 'BACKGROUND_FAILED';
}

/**
 * Code for a failed export. The encoders throw plain errors, so this is the
 * one place their wording is read — kept to the few the person can act on.
 */
export function exportCodeFor(err: unknown): ErrorCode {
  if (err instanceof OrdioError) return err.code;
  if (err instanceof RangeError) return 'EXPORT_OUT_OF_MEMORY';
  if (err instanceof DOMException && err.name === 'QuotaExceededError') return 'EXPORT_OUT_OF_MEMORY';
  const message = err instanceof Error ? err.message : '';
  if (/background video/i.test(message)) return 'EXPORT_BACKGROUND_UNREADABLE';
  if (/canvas context/i.test(message)) return 'EXPORT_CANVAS_UNAVAILABLE';
  if (/produced no output/i.test(message)) return 'EXPORT_EMPTY_OUTPUT';
  if (/memory|allocation/i.test(message)) return 'EXPORT_OUT_OF_MEMORY';
  return 'EXPORT_FAILED';
}
