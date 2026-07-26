import { describe, it, expect } from 'vitest';
import * as video from '@Ordio/engine/video';

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

  it('should export drawWordSwapCaptions function', () => {
    expect(typeof video.drawWordSwapCaptions).toBe('function');
  });

  it('should export drawPhraseCutCaptions function', () => {
    expect(typeof video.drawPhraseCutCaptions).toBe('function');
  });

  it('should export drawStaticHighlightCaptions function', () => {
    expect(typeof video.drawStaticHighlightCaptions).toBe('function');
  });

  it('should export measureWordSwapCaptionBlock function', () => {
    expect(typeof video.measureWordSwapCaptionBlock).toBe('function');
  });

  it('should export measurePhraseCutCaptionBlock function', () => {
    expect(typeof video.measurePhraseCutCaptionBlock).toBe('function');
  });

  it('should export measureStaticHighlightCaptionBlock function', () => {
    expect(typeof video.measureStaticHighlightCaptionBlock).toBe('function');
  });

  it('should export hasWebCodecsSupport function', () => {
    expect(typeof video.hasWebCodecsSupport).toBe('function');
  });
});
