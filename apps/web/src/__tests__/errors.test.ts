import { describe, it, expect, vi, beforeEach } from 'vitest';
import OpenAI from 'openai';
import { toast } from 'sonner';
import { ERROR_CATALOG, isErrorCode, type ErrorCode } from '@/lib/errors/catalog';
import { OrdioError, toOrdioError } from '@/lib/errors/OrdioError';
import {
  classifyMicError,
  decodeCodeFor,
  directorCodeFor,
  exportCodeFor,
  transcribeCodeFor,
  uploadCodeFor,
} from '@/lib/errors/classify';
import { notifyError } from '@/lib/errors/notify';
import { InsufficientCreditsError, transcriptionErrorFor } from '@/lib/transcription/insufficientCredits';
import { providerErrorCode, STATUS_FOR } from '@/app/api/transcribe/providerError';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}));

function domError(name: string): DOMException {
  return new DOMException('x', name);
}

describe('the catalog', () => {
  const entries = Object.entries(ERROR_CATALOG);

  it('gives every code a title and a next step', () => {
    for (const [code, copy] of entries) {
      expect(copy.title.trim(), code).not.toBe('');
      expect(copy.detail.trim(), code).not.toBe('');
    }
  });

  it('never names a provider or a status code on screen', () => {
    for (const [code, copy] of entries) {
      const text = `${copy.title} ${copy.detail}`;
      expect(text, code).not.toMatch(/openai|whisper|convex|clerk|modal|\bHTTP\b|\b[45]\d\d\b/i);
    }
  });

  it('recognises its own codes and nothing else', () => {
    expect(isErrorCode('TRANSCRIBE_TIMEOUT')).toBe(true);
    expect(isErrorCode('transcribe_timeout')).toBe(false);
    expect(isErrorCode('toString')).toBe(false);
    expect(isErrorCode(undefined)).toBe(false);
  });
});

describe('toOrdioError', () => {
  it('keeps a named failure found anywhere in the cause chain', () => {
    const inner = new OrdioError('TRANSCRIBE_RATE_LIMITED');
    const wrapped = new Error('outer', { cause: new Error('middle', { cause: inner }) });
    expect(toOrdioError(wrapped, 'UNKNOWN').code).toBe('TRANSCRIBE_RATE_LIMITED');
  });

  it('reads a failed fetch as a connection problem, not the fallback', () => {
    expect(toOrdioError(new TypeError('Failed to fetch'), 'UPLOAD_FAILED').code).toBe('NETWORK_FAILED');
  });

  it('says offline when the browser knows it is', () => {
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(toOrdioError(new TypeError('Load failed')).code).toBe('NETWORK_OFFLINE');
    spy.mockRestore();
  });

  it('falls back for anything unnamed, keeping the original message for the log', () => {
    const failure = toOrdioError(new Error('ffmpeg exploded'), 'EXPORT_FAILED');
    expect(failure.code).toBe('EXPORT_FAILED');
    expect(failure.message).toBe('ffmpeg exploded');
  });
});

describe('classifyMicError', () => {
  it.each<[string, ErrorCode]>([
    ['NotAllowedError', 'MIC_PERMISSION_DENIED'],
    ['SecurityError', 'MIC_PERMISSION_DENIED'],
    ['NotFoundError', 'MIC_NOT_FOUND'],
    ['OverconstrainedError', 'MIC_NOT_FOUND'],
    ['NotReadableError', 'MIC_IN_USE'],
    ['NotSupportedError', 'RECORDING_UNSUPPORTED'],
    ['SomethingNew', 'MIC_START_FAILED'],
  ])('%s → %s', (name, code) => {
    expect(classifyMicError(domError(name))).toBe(code);
  });

  it('blames the connection when there is no mediaDevices at all', () => {
    const original = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    expect(classifyMicError(domError('NotAllowedError'))).toBe('MIC_INSECURE_CONTEXT');
    Object.defineProperty(navigator, 'mediaDevices', { value: original, configurable: true });
  });
});

describe('transcribeCodeFor', () => {
  it('trusts the code the route sent', () => {
    expect(transcribeCodeFor(502, { code: 'TRANSCRIBE_PROVIDER_BUSY' })).toBe('TRANSCRIBE_PROVIDER_BUSY');
  });

  it('ignores a code it does not know', () => {
    expect(transcribeCodeFor(500, { code: 'SOMETHING_ELSE' })).toBe('TRANSCRIBE_FAILED');
  });

  it.each<[number, ErrorCode]>([
    [401, 'AUTH_REQUIRED'],
    [402, 'INSUFFICIENT_CREDITS'],
    [413, 'TRANSCRIBE_FILE_TOO_LARGE'],
    [429, 'TRANSCRIBE_RATE_LIMITED'],
    [503, 'TRANSCRIBE_UNAVAILABLE'],
    [504, 'TRANSCRIBE_TIMEOUT'],
    [500, 'TRANSCRIBE_FAILED'],
  ])('names a bare %i as %s (platform responses carry no body)', (status, code) => {
    expect(transcribeCodeFor(status, '<html>')).toBe(code);
  });
});

describe('transcriptionErrorFor', () => {
  it('still returns the credits error, which is now a named failure', () => {
    const err = transcriptionErrorFor(402, { minutes: 0 });
    expect(err).toBeInstanceOf(InsufficientCreditsError);
    expect(err.code).toBe('INSUFFICIENT_CREDITS');
  });

  it('carries the route code on every other failure', () => {
    expect(transcriptionErrorFor(504, {}).code).toBe('TRANSCRIBE_TIMEOUT');
  });
});

describe('providerErrorCode', () => {
  const apiError = (status: number, body: object = {}) =>
    OpenAI.APIError.generate(status, body, 'provider said no', new Headers());

  it.each<[number, ErrorCode]>([
    [400, 'TRANSCRIBE_AUDIO_REJECTED'],
    [401, 'TRANSCRIBE_UNAVAILABLE'],
    [413, 'TRANSCRIBE_FILE_TOO_LARGE'],
    [429, 'TRANSCRIBE_PROVIDER_BUSY'],
    [500, 'TRANSCRIBE_PROVIDER_BUSY'],
  ])('maps a provider %i to %s', (status, code) => {
    expect(providerErrorCode(apiError(status))).toBe(code);
  });

  it('treats an exhausted org quota as ours, not as the person hitting a limit', () => {
    // OpenAI nests the code under `error` in the response body.
    const quota = apiError(429, { error: { code: 'insufficient_quota' } });
    expect(providerErrorCode(quota)).toBe('TRANSCRIBE_UNAVAILABLE');
  });

  it('tells a timeout from an unreachable service', () => {
    expect(providerErrorCode(new OpenAI.APIConnectionTimeoutError())).toBe('TRANSCRIBE_TIMEOUT');
    expect(providerErrorCode(new OpenAI.APIConnectionError({ message: 'ECONNRESET' }))).toBe(
      'TRANSCRIBE_PROVIDER_UNREACHABLE'
    );
  });

  it('reads a missing key as unavailable', () => {
    expect(providerErrorCode(new Error('OPENAI_API_KEY is not set'))).toBe('TRANSCRIBE_UNAVAILABLE');
  });

  it('answers every code it can produce with a real status', () => {
    for (const code of Object.keys(STATUS_FOR)) {
      expect(isErrorCode(code), code).toBe(true);
    }
  });
});

describe('the smaller classifiers', () => {
  it('names each decode reason', () => {
    const decode = (code: string) => Object.assign(new Error('x'), { name: 'MediaDecodeError', code });
    expect(decodeCodeFor(decode('no_audio_track'))).toBe('AUDIO_NO_TRACK');
    expect(decodeCodeFor(decode('codec_unsupported'))).toBe('AUDIO_CODEC_UNSUPPORTED');
    expect(decodeCodeFor(decode('empty'))).toBe('AUDIO_EMPTY');
    expect(decodeCodeFor(new Error('anything'))).toBe('AUDIO_DECODE_FAILED');
  });

  it('names storage upload failures', () => {
    expect(uploadCodeFor(413)).toBe('FILE_TOO_LARGE');
    expect(uploadCodeFor(500)).toBe('UPLOAD_FAILED');
  });

  it('names Director failures', () => {
    expect(directorCodeFor(429)).toBe('DIRECTOR_RATE_LIMITED');
    expect(directorCodeFor(502)).toBe('DIRECTOR_NO_LOOKS');
  });

  it('names export failures the person can act on', () => {
    expect(exportCodeFor(new RangeError('Array buffer allocation failed'))).toBe('EXPORT_OUT_OF_MEMORY');
    expect(exportCodeFor(new Error('Cannot decode background video in this browser.'))).toBe(
      'EXPORT_BACKGROUND_UNREADABLE'
    );
    expect(exportCodeFor(new Error('Encoding produced no output'))).toBe('EXPORT_EMPTY_OUTPUT');
    expect(exportCodeFor(new Error('???'))).toBe('EXPORT_FAILED');
  });
});

describe('notifyError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('toasts the catalog title, keyed by code so repeats replace each other', () => {
    notifyError(new OrdioError('MIC_IN_USE'));
    expect(toast.error).toHaveBeenCalledWith(
      'Your microphone is busy',
      expect.objectContaining({ id: 'MIC_IN_USE' })
    );
  });

  it('routes warnings and info to their own toast', () => {
    notifyError(new OrdioError('TRANSCRIBE_NO_SPEECH'));
    notifyError(new OrdioError('CLIPS_AI_UNAVAILABLE'));
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('uses the fallback for an unnamed failure', () => {
    notifyError(new Error('nope'), { fallback: 'SESSION_DELETE_FAILED' });
    expect(toast.error).toHaveBeenCalledWith(
      'Could not delete this recording',
      expect.objectContaining({ id: 'SESSION_DELETE_FAILED' })
    );
  });

  it('says nothing about a cancellation', () => {
    notifyError(new DOMException('Aborted', 'AbortError'));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
