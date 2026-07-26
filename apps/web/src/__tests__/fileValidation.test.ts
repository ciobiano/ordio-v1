import { describe, it, expect } from 'vitest';
import { validateFile, FILE_ACCEPT_ATTRIBUTE } from '@/lib/fileValidation';

function makeFile(name: string, type: string, size = 1024): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('validateFile', () => {
  it('accepts mp3 files', () => {
    expect(validateFile(makeFile('voice-note.mp3', 'audio/mpeg'))).toBeNull();
    expect(validateFile(makeFile('voice-note.mp3', 'audio/mp3'))).toBeNull();
  });

  it('accepts m4a files', () => {
    expect(validateFile(makeFile('voice-note.m4a', 'audio/m4a'))).toBeNull();
    expect(validateFile(makeFile('voice-note.m4a', 'audio/x-m4a'))).toBeNull();
  });

  it('falls back to extension when the MIME type is empty or generic', () => {
    expect(validateFile(makeFile('voice-note.mp3', ''))).toBeNull();
    expect(validateFile(makeFile('voice-note.m4a', 'application/octet-stream'))).toBeNull();
  });

  it('rejects an unsupported format', () => {
    expect(validateFile(makeFile('document.pdf', 'application/pdf'))).toBe('unsupported_format');
  });

  it('rejects a file over the size cap', () => {
    const big = makeFile('voice-note.mp3', 'audio/mpeg', 51 * 1024 * 1024);
    expect(validateFile(big)).toBe('too_large');
  });
});

describe('FILE_ACCEPT_ATTRIBUTE', () => {
  it('includes .mp3 and .m4a as explicit extensions', () => {
    const entries = FILE_ACCEPT_ATTRIBUTE.split(',');
    expect(entries).toContain('.mp3');
    expect(entries).toContain('.m4a');
  });

  it('includes the m4a MIME types, not just the extension', () => {
    const entries = FILE_ACCEPT_ATTRIBUTE.split(',');
    expect(entries).toContain('audio/m4a');
    expect(entries).toContain('audio/x-m4a');
  });

  it('still includes the video formats the upload sheet already supported', () => {
    const entries = FILE_ACCEPT_ATTRIBUTE.split(',');
    expect(entries).toContain('.mov');
    expect(entries).toContain('.mkv');
    expect(entries).toContain('video/quicktime');
  });
});
