import { describe, it, expect } from 'vitest';
import {
  InsufficientCreditsError,
  transcriptionErrorFor,
  INSUFFICIENT_CREDITS_STATUS,
} from '@/lib/transcription/insufficientCredits';

describe('transcriptionErrorFor', () => {
  it('returns the credits error for a 402 with our body', () => {
    const err = transcriptionErrorFor(402, {
      error: 'Out of transcription credits',
      code: 'INSUFFICIENT_CREDITS',
      minutes: 0,
    });

    expect(err).toBeInstanceOf(InsufficientCreditsError);
    expect((err as InsufficientCreditsError).minutesRemaining).toBe(0);
  });

  it('carries the remaining minutes through so the prompt can name them', () => {
    const err = transcriptionErrorFor(402, { code: 'INSUFFICIENT_CREDITS', minutes: 3 });
    expect((err as InsufficientCreditsError).minutesRemaining).toBe(3);
  });

  it('still routes to the upgrade path on a bare 402 with no body', () => {
    // A proxy or edge layer can strip the body; the status alone must be enough.
    expect(transcriptionErrorFor(INSUFFICIENT_CREDITS_STATUS, {})).toBeInstanceOf(
      InsufficientCreditsError
    );
  });

  it('honours the code even if the status was rewritten', () => {
    expect(transcriptionErrorFor(500, { code: 'INSUFFICIENT_CREDITS' })).toBeInstanceOf(
      InsufficientCreditsError
    );
  });

  it.each([500, 503, 429, 413])('returns a plain Error for %d', (status) => {
    const err = transcriptionErrorFor(status, { error: 'Transcription failed' });
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(InsufficientCreditsError);
  });

  it('uses the server message when there is one', () => {
    expect(transcriptionErrorFor(413, { error: 'Audio file exceeds 25MB Whisper limit' }).message).toBe(
      'Audio file exceeds 25MB Whisper limit'
    );
  });

  it('falls back to a message naming the status when the body is empty', () => {
    expect(transcriptionErrorFor(500, {}).message).toBe('Transcription failed (500)');
  });

  it.each([null, undefined, 'a string', 42])('survives a non-object body (%p)', (body) => {
    expect(() => transcriptionErrorFor(500, body)).not.toThrow();
  });

  it('does not treat a non-numeric minutes field as a count', () => {
    const err = transcriptionErrorFor(402, { code: 'INSUFFICIENT_CREDITS', minutes: 'lots' });
    expect((err as InsufficientCreditsError).minutesRemaining).toBe(0);
  });
});
