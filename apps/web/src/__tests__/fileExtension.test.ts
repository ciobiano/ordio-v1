import { describe, it, expect } from 'vitest';
import { fileExtension } from '@/hooks/video/useVideoExporter';

describe('fileExtension()', () => {
  it('returns mp4 for video/mp4 mime types', () => {
    expect(fileExtension('video/mp4')).toBe('mp4');
    expect(fileExtension('video/mp4;codecs=h264,aac')).toBe('mp4');
    expect(fileExtension('video/mp4;codecs=avc1')).toBe('mp4');
  });

  it('returns webm for video/webm mime types', () => {
    expect(fileExtension('video/webm')).toBe('webm');
    expect(fileExtension('video/webm;codecs=vp9,opus')).toBe('webm');
  });

  it('returns webm as fallback for unknown types', () => {
    expect(fileExtension('video/ogg')).toBe('webm');
    expect(fileExtension('')).toBe('webm');
  });
});
