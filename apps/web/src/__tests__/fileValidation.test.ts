import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { validateFile, validateEpisodeFile, FILE_ACCEPT_ATTRIBUTE } from '@/lib/fileValidation';

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

  it('includes m4b, both extension and the types platforms report for it', () => {
    const entries = FILE_ACCEPT_ATTRIBUTE.split(',');
    expect(entries).toContain('.m4b');
    expect(entries).toContain('audio/m4b');
    expect(entries).toContain('audio/x-m4b');
  });
});

describe('m4b audiobooks', () => {
  function makeFile(name: string, type: string, size = 1024): File {
    return new File([new Uint8Array(size)], name, { type });
  }

  it('is accepted however the platform types it', () => {
    // No registered type for m4b, so this varies by OS and browser.
    expect(validateFile(makeFile('book.m4b', 'audio/x-m4b'))).toBeNull();
    expect(validateFile(makeFile('book.m4b', 'audio/mp4'))).toBeNull();
    expect(validateFile(makeFile('book.m4b', ''))).toBeNull();
    expect(validateFile(makeFile('book.m4b', 'application/octet-stream'))).toBeNull();
  });

  it('is accepted on the episode route, where a long book actually lands', () => {
    const book = makeFile('book.m4b', 'audio/x-m4b', 120 * 1024 * 1024);
    expect(validateEpisodeFile(book)).toBeNull();
    // Still capped: the clip-finder route tops out at 250 MB.
    expect(validateEpisodeFile(makeFile('book.m4b', 'audio/x-m4b', 300 * 1024 * 1024))).toBe(
      'episode_too_large'
    );
  });
});

/**
 * The unit tests above already asserted `.mp3` was in FILE_ACCEPT_ATTRIBUTE —
 * and they passed while mp3 was greyed out in the picker, because the bug was
 * never in the shared constant. It was in three hand-written copies of the list
 * that bypassed it, one of which overwrote `input.accept` at click time.
 *
 * A duplicate is the failure mode here, so this guards against the duplicate
 * rather than against its contents.
 */
describe('nothing hand-writes a second accept list', () => {
  // Assembled so this file does not trip its own check.
  const WILDCARD = `audio/${'*'}`;
  const SOURCE_ROOT = join(__dirname, '..');
  const ALLOWED = ['lib/fileValidation.ts'];

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        return entry === '__tests__' || entry === 'node_modules' ? [] : sourceFiles(full);
      }
      return /\.tsx?$/.test(entry) ? [full] : [];
    });
  }

  it('does not use the audio wildcard, which OS pickers expand unreliably', () => {
    const offenders = sourceFiles(SOURCE_ROOT)
      .map((file) => relative(SOURCE_ROOT, file))
      .filter((file) => !ALLOWED.includes(file))
      .filter((file) => readFileSync(join(SOURCE_ROOT, file), 'utf8').includes(WILDCARD));

    // Import FILE_ACCEPT_ATTRIBUTE instead: every format needs its extension
    // spelled out, and a second copy of the list always drifts from the first.
    expect(offenders).toEqual([]);
  });
});
