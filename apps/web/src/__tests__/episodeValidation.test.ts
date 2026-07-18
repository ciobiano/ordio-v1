import { describe, it, expect } from 'vitest';
import { validateEpisodeFile, MAX_EPISODE_FILE_BYTES } from '@/lib/fileValidation';

const mkFile = (size: number, type = 'audio/mpeg', name = 'ep.mp3') => {
  const f = new File([''], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

describe('validateEpisodeFile', () => {
  it('accepts a 200MB mp3', () => {
    expect(validateEpisodeFile(mkFile(200 * 1024 * 1024))).toBeNull();
  });
  it('rejects above 250MB', () => {
    expect(validateEpisodeFile(mkFile(MAX_EPISODE_FILE_BYTES + 1))).toBe('episode_too_large');
  });
  it('rejects unsupported formats', () => {
    expect(validateEpisodeFile(mkFile(1000, 'application/pdf', 'x.pdf'))).toBe('unsupported_format');
  });
});
