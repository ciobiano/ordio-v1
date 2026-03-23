import { describe, it, expect } from 'vitest';

// Test the MIME-to-filename extension derivation logic used in transcribe/route.ts
// The logic: file.type.split('/')[1]?.replace('mpeg', 'mp3') ?? 'webm'
function getAudioExt(mimeType: string): string {
  return mimeType.split('/')[1]?.replace('mpeg', 'mp3') ?? 'webm';
}

describe('Whisper audio filename extension derivation', () => {
  it('returns webm for audio/webm', () => {
    expect(getAudioExt('audio/webm')).toBe('webm');
  });

  it('returns mp3 for audio/mpeg (standard MP3 MIME type)', () => {
    expect(getAudioExt('audio/mpeg')).toBe('mp3');
  });

  it('returns wav for audio/wav', () => {
    expect(getAudioExt('audio/wav')).toBe('wav');
  });

  it('returns mp4 for audio/mp4', () => {
    expect(getAudioExt('audio/mp4')).toBe('mp4');
  });

  it('returns ogg for audio/ogg', () => {
    expect(getAudioExt('audio/ogg')).toBe('ogg');
  });

  it('returns webm as fallback when mime type is empty', () => {
    expect(getAudioExt('')).toBe('webm');
  });
});
