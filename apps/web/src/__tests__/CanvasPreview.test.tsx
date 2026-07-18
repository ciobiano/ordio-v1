import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { toast } from 'sonner';
import CanvasPreview from '@/components/primitives/video/CanvasPreview';
import { useUIStore, useProcessingStore, useCaptureStore } from '@/stores';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock('@Ordio/engine/video', () => ({
  renderFrame: vi.fn().mockImplementation(() => {
    throw new Error('boom');
  }),
}));

vi.mock('@Ordio/engine/loaders', () => ({
  loadFont: vi.fn().mockResolvedValue(undefined),
  loadGraphic: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/components/primitives/video/canvas-preview/useBackgroundVideo', () => ({
  useBackgroundVideo: vi.fn().mockReturnValue({ bgVideo: null, bgLoading: false }),
}));

function buildPlayback(): UsePlaybackReturn {
  return {
    isPlaying: false,
    currentTime: 0,
    duration: 10,
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    previewAt: vi.fn(),
    registerTimeListener: vi.fn().mockReturnValue(() => {}),
  } as unknown as UsePlaybackReturn;
}

describe('components/primitives/video: CanvasPreview crash surfacing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom has no real canvas backend — getContext('2d') returns null by
    // default, which would make drawCurrentFrame's early-return fire before
    // ever reaching the try/catch this test exists to exercise. Stub it to
    // return a truthy object; the mocked renderFrame below never actually
    // draws with it, it just needs to not be null.
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({});
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
      },
      captionAnimation: 'none',
      captionTransform: { visible: true, scale: 1, rotationDeg: 0, offsetXRatio: 0, offsetYRatio: 0 },
    });
    useProcessingStore.setState({ transcript: [], captionGroups: [] });
    useCaptureStore.setState({ audioBuffer: null });
  });

  it('does not throw when drawCurrentFrame errors, and toasts once', () => {
    expect(() =>
      render(
        <CanvasPreview
          playback={buildPlayback()}
          format="square"
          waveformStyle="bars"
          captionMode="phrase"
        />
      )
    ).not.toThrow();

    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});
