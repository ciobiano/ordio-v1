import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { fileExtension } from '@/hooks/video/useVideoExporter';
import { useVideoExporter } from '@/hooks/video/useVideoExporter';
import { useProcessingStore, useUIStore } from '@/stores';

vi.mock('@/lib/video', () => ({
  encodeVideo: vi.fn().mockResolvedValue({
    blob: new Blob(['test'], { type: 'video/mp4' }),
    mimeType: 'video/mp4',
  }),
  encodeVideoFFmpeg: vi.fn().mockResolvedValue({
    blob: new Blob(['test'], { type: 'video/mp4' }),
    mimeType: 'video/mp4',
  }),
  hasWebCodecsSupport: vi.fn().mockReturnValue(true),
}));

describe('hooks/video: useVideoExporter', () => {
  beforeEach(() => {
    useProcessingStore.setState({
      transcript: [],
    });
    useUIStore.setState({
      style: {
        width: 1080,
        height: 1080,
        backgroundColor: '#000000',
        textColor: '#ffffff',
        fontFamily: 'Inter',
        fontSize: 72,
        waveColor: '#ffffff',
        characterSpacing: 0,
        lineHeight: 1.4,
        captionStyleId: 'minimal-lower-third',
      },
      waveformStyle: 'bars',
      canvasLayout: 'compact',
      graphicStyle: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fileExtension', () => {
    it('should return mp4 for video/mp4', () => {
      expect(fileExtension('video/mp4')).toBe('mp4');
    });

    it('should return mp4 for video/mp4; codecs="avc1.42E01E"', () => {
      expect(fileExtension('video/mp4; codecs="avc1.42E01E"')).toBe('mp4');
    });

    it('should return webm for video/webm', () => {
      expect(fileExtension('video/webm')).toBe('webm');
    });

    it('should return webm for video/webm; codecs="vp9"', () => {
      expect(fileExtension('video/webm; codecs="vp9"')).toBe('webm');
    });

    it('should return webm for video/VP9', () => {
      expect(fileExtension('video/VP9')).toBe('webm');
    });

    it('should handle empty string', () => {
      expect(fileExtension('')).toBe('webm');
    });

    it('should handle unknown mime type', () => {
      expect(fileExtension('video/ogg')).toBe('webm');
    });
  });

  describe('useVideoExporter hook', () => {
    it('should have initial state', () => {
      const { result } = renderHook(() => useVideoExporter());
      expect(result.current.isExporting).toBe(false);
      expect(result.current.exportProgress).toBe(0);
      expect(result.current.exportedUrl).toBeNull();
      expect(result.current.exportMimeType).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should provide startExport function', () => {
      const { result } = renderHook(() => useVideoExporter());
      expect(typeof result.current.startExport).toBe('function');
    });

    it('should provide cancelExport function', () => {
      const { result } = renderHook(() => useVideoExporter());
      expect(typeof result.current.cancelExport).toBe('function');
    });
  });
});
