import { describe, it, expect } from 'vitest';
import * as video from '@/lib/video';

describe('lib/video: exports', () => {
  it('should export encodeVideo function', () => {
    expect(typeof video.encodeVideo).toBe('function');
  });

  it('should export encodeVideoFFmpeg function', () => {
    expect(typeof video.encodeVideoFFmpeg).toBe('function');
  });

  it('should export renderFrame function', () => {
    expect(typeof video.renderFrame).toBe('function');
  });

  it('should export drawKaraokeCaptions function', () => {
    expect(typeof video.drawKaraokeCaptions).toBe('function');
  });

  it('should export measureKaraokeCaptionBlock function', () => {
    expect(typeof video.measureKaraokeCaptionBlock).toBe('function');
  });

  it('should export karaokeNonActiveFills function', () => {
    expect(typeof video.karaokeNonActiveFills).toBe('function');
  });

  it('should export drawStackCaptions function', () => {
    expect(typeof video.drawStackCaptions).toBe('function');
  });

  it('should export drawSpotlightCaptions function', () => {
    expect(typeof video.drawSpotlightCaptions).toBe('function');
  });

  it('should export hasWebCodecsSupport function', () => {
    expect(typeof video.hasWebCodecsSupport).toBe('function');
  });
});
