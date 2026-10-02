import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { toast } from 'sonner';
import CanvasPreview from '@/components/media/video/CanvasPreview';
import { useUIStore, useProcessingStore, useCaptureStore } from '@/stores';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}));

vi.mock('convex/react', () => ({
  useQuery: () => undefined,
  useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }),
  useMutation: () => vi.fn().mockResolvedValue(undefined),
}));

const renderFrameMock = vi.fn().mockImplementation(() => {
  throw new Error('boom');
});

vi.mock('@Ordio/engine/video', () => ({
  renderFrame: (...args: unknown[]) => renderFrameMock(...args),
}));

vi.mock('@Ordio/engine/loaders', () => ({
  loadFont: vi.fn().mockResolvedValue(undefined),
  loadGraphic: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/components/media/video/canvas-preview/useBackgroundVideo', () => ({
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
  const drawImageMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    renderFrameMock.mockImplementation(() => {
      throw new Error('boom');
    });
    // jsdom has no real canvas backend — getContext('2d') returns null by
    // default, which would make drawCurrentFrame's early-return fire before
    // ever reaching the try/catch this test exists to exercise. Stub it to
    // return a truthy object shared by both the visible canvas and the
    // internal off-screen buffer canvas, so drawImageMock observes the
    // blit regardless of which one it was conceptually called on.
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({ drawImage: drawImageMock });
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
        textAlign: 'center',
        verticalAlign: 'auto',
        backgroundScrim: 'flat',
        captionStyleId: 'minimal-lower-third',
      },
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
        />
      )
    ).not.toThrow();

    // A preview hiccup is a warning, not an error: audio and export still work.
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.warning).toHaveBeenCalledWith(
      'Preview is temporarily unavailable',
      expect.objectContaining({ id: 'PREVIEW_RENDER_FAILED' })
    );
  });

  it('never blits to the visible canvas when the render errors — true freeze, not a half-composited frame', () => {
    render(
      <CanvasPreview
        playback={buildPlayback()}
        format="square"
        waveformStyle="bars"
      />
    );

    // renderFrame throws before any drawImage call is reached — the
    // off-screen buffer never gets blitted onto the visible canvas.
    expect(drawImageMock).not.toHaveBeenCalled();
  });

  it('blits the off-screen buffer to the visible canvas on a successful render', () => {
    renderFrameMock.mockImplementation(() => {});

    render(
      <CanvasPreview
        playback={buildPlayback()}
        format="square"
        waveformStyle="bars"
      />
    );

    expect(drawImageMock).toHaveBeenCalled();
  });
});
