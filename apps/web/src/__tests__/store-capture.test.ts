import { describe, it, expect, beforeEach } from 'vitest';
import { useCaptureStore } from '@/stores/captureStore';

describe('store: captureStore', () => {
  beforeEach(() => {
    useCaptureStore.getState().resetCapture();
  });

  describe('initial state', () => {
    it('should have null audioBlob', () => {
      expect(useCaptureStore.getState().audioBlob).toBeNull();
    });

    it('should have null audioBuffer', () => {
      expect(useCaptureStore.getState().audioBuffer).toBeNull();
    });

    it('should have zero audioDuration', () => {
      expect(useCaptureStore.getState().audioDuration).toBe(0);
    });

    it('should not be recording', () => {
      expect(useCaptureStore.getState().isRecording).toBe(false);
    });

    it('should not be playing', () => {
      expect(useCaptureStore.getState().isPlaying).toBe(false);
    });
  });

  describe('setAudioBlob', () => {
    it('should set audioBlob', () => {
      const blob = new Blob(['test'], { type: 'audio/wav' });
      useCaptureStore.getState().setAudioBlob(blob);
      expect(useCaptureStore.getState().audioBlob).toBe(blob);
    });

    it('should allow setting null', () => {
      const blob = new Blob(['test'], { type: 'audio/wav' });
      useCaptureStore.getState().setAudioBlob(blob);
      useCaptureStore.getState().setAudioBlob(null);
      expect(useCaptureStore.getState().audioBlob).toBeNull();
    });
  });

  describe('setAudioBuffer', () => {
    it('should set audioBuffer', () => {
      const mockBuffer = {} as AudioBuffer;
      useCaptureStore.getState().setAudioBuffer(mockBuffer);
      expect(useCaptureStore.getState().audioBuffer).toBe(mockBuffer);
    });
  });

  describe('setAudioDuration', () => {
    it('should set audioDuration', () => {
      useCaptureStore.getState().setAudioDuration(30.5);
      expect(useCaptureStore.getState().audioDuration).toBe(30.5);
    });
  });

  describe('setIsRecording', () => {
    it('should set isRecording to true', () => {
      useCaptureStore.getState().setIsRecording(true);
      expect(useCaptureStore.getState().isRecording).toBe(true);
    });

    it('should set isRecording to false', () => {
      useCaptureStore.getState().setIsRecording(true);
      useCaptureStore.getState().setIsRecording(false);
      expect(useCaptureStore.getState().isRecording).toBe(false);
    });
  });

  describe('setIsPlaying', () => {
    it('should set isPlaying to true', () => {
      useCaptureStore.getState().setIsPlaying(true);
      expect(useCaptureStore.getState().isPlaying).toBe(true);
    });

    it('should set isPlaying to false', () => {
      useCaptureStore.getState().setIsPlaying(true);
      useCaptureStore.getState().setIsPlaying(false);
      expect(useCaptureStore.getState().isPlaying).toBe(false);
    });
  });

  describe('resetCapture', () => {
    it('should reset all state to initial values', () => {
      useCaptureStore.getState().setAudioBlob(new Blob(['test']));
      useCaptureStore.getState().setAudioDuration(30);
      useCaptureStore.getState().setIsRecording(true);
      useCaptureStore.getState().setIsPlaying(true);

      useCaptureStore.getState().resetCapture();

      const state = useCaptureStore.getState();
      expect(state.audioBlob).toBeNull();
      expect(state.audioBuffer).toBeNull();
      expect(state.audioDuration).toBe(0);
      expect(state.isRecording).toBe(false);
      expect(state.isPlaying).toBe(false);
    });
  });
});
