import { describe, it, expect } from 'vitest';
import { getOpenAITranscriptionFilename } from '@/app/api/transcribe/audioFile';

function createUpload(name: string, type: string): File {
  return new File(['audio'], name, { type });
}

describe('Whisper audio filename extension derivation', () => {
  it('returns webm for audio/webm', () => {
    expect(getOpenAITranscriptionFilename(createUpload('recording.webm', 'audio/webm'))).toBe(
      'audio.webm'
    );
  });

  it('returns mp3 for audio/mpeg (standard MP3 MIME type)', () => {
    expect(getOpenAITranscriptionFilename(createUpload('recording', 'audio/mpeg'))).toBe(
      'audio.mp3'
    );
  });

  it('returns wav for audio/wav', () => {
    expect(getOpenAITranscriptionFilename(createUpload('recording.wav', 'audio/wav'))).toBe(
      'audio.wav'
    );
  });

  it('returns mp4 for audio/mp4', () => {
    expect(getOpenAITranscriptionFilename(createUpload('recording.mp4', 'audio/mp4'))).toBe(
      'audio.mp4'
    );
  });

  it('returns ogg for audio/ogg', () => {
    expect(getOpenAITranscriptionFilename(createUpload('recording.ogg', 'audio/ogg'))).toBe(
      'audio.ogg'
    );
  });

  it('normalizes audio/x-m4a to an OpenAI-supported m4a filename', () => {
    expect(
      getOpenAITranscriptionFilename(createUpload('New Recording 15.m4a', 'audio/x-m4a'))
    ).toBe('audio.m4a');
  });

  it('preserves supported extensions when the MIME type is generic', () => {
    expect(
      getOpenAITranscriptionFilename(
        createUpload('New Recording 15.m4a', 'application/octet-stream')
      )
    ).toBe('audio.m4a');
  });

  it('normalizes x-wav MIME aliases', () => {
    expect(getOpenAITranscriptionFilename(createUpload('recording', 'audio/x-wav'))).toBe(
      'audio.wav'
    );
  });

  it('returns webm as fallback when mime type is empty', () => {
    expect(getOpenAITranscriptionFilename(createUpload('recording', ''))).toBe('audio.webm');
  });
});
