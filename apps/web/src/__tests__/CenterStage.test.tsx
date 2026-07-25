import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CenterStage } from '@/components/studio/CenterStage';
import type { UseStudioFlowReturn } from '@/hooks/studio/useStudioFlow';

const mockPlayback = {
  isPlaying: false,
  currentTime: 0,
  duration: 47,
  play: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
  seek: vi.fn(),
  previewAt: vi.fn(),
  load: vi.fn(),
  registerTimeListener: vi.fn(() => () => {}),
};

vi.mock('@/components/primitives/video/CanvasPreview', () => ({
  default: () => <div data-testid="canvas-preview" />,
}));
vi.mock('@/stores', () => ({
  useUIStore: (
    selector: (s: {
      format: string;
      waveformStyle: string;
      captionMode: string;
      canvasLayout: string;
      graphicStyle: null;
    }) => unknown
  ) =>
    selector({
      format: 'vertical',
      waveformStyle: 'bars',
      captionMode: 'karaoke',
      canvasLayout: 'top',
      graphicStyle: null,
    }),
}));
vi.mock('@/components/studio/StudioExportBody', () => ({
  StudioExportBody: () => <div data-testid="export-body" />,
}));

const mockMics = {
  devices: [],
  selectedDeviceId: undefined,
  selectDevice: vi.fn(),
  refresh: vi.fn(async () => {}),
};

function makeFlow(overrides: Partial<UseStudioFlowReturn>): UseStudioFlowReturn {
  return {
    view: 'idle',
    sessionId: null,
    recordingTime: 0,
    processingProgress: 0,
    transcript: [],
    liveCaptionText: '',
    isStarting: false,
    micDenied: false,
    mics: mockMics,
    episode: {
      phase: 'idle',
      progress: 0,
      candidates: [],
      episodeFile: null,
      episodeWords: [],
      error: null,
      partialAvailable: false,
      startEpisode: vi.fn(),
      usePartialTranscript: vi.fn(),
      cancel: vi.fn(),
    },
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    processFile: vi.fn(),
    openEpisodeClip: vi.fn(),
    openClip: vi.fn(),
    goIdle: vi.fn(),
    goExport: vi.fn(),
    getAudioLevel: vi.fn(() => 0),
    cancelProcessing: vi.fn(),
    ...overrides,
  };
}

describe('CenterStage', () => {
  it('idle: shows the record orb and calls startRecording on click', () => {
    const flow = makeFlow({ view: 'idle' });
    render(<CenterStage flow={flow} sessionData={null} audioLevel={0} playback={mockPlayback} onOpenPalette={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /tap to record/i }));
    expect(flow.startRecording).toHaveBeenCalled();
  });

  it('capture: shows recording timer and calls stopRecording on click', () => {
    const flow = makeFlow({ view: 'capture', recordingTime: 12 });
    render(<CenterStage flow={flow} sessionData={null} audioLevel={0} playback={mockPlayback} onOpenPalette={vi.fn()} />);
    expect(screen.getByText(/recording/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /stop recording/i }));
    expect(flow.stopRecording).toHaveBeenCalled();
  });

  it('capture: renders the tail of the live caption text', () => {
    const words = Array.from({ length: 20 }, (_, i) => `word${i + 1}`);
    const flow = makeFlow({ view: 'capture', liveCaptionText: words.join(' ') });
    render(<CenterStage flow={flow} sessionData={null} audioLevel={0} playback={mockPlayback} onOpenPalette={vi.fn()} />);
    // Slot shows only the last 12 words, teleprompter-style.
    expect(screen.getByText(/word20/)).toBeInTheDocument();
    expect(screen.queryByText(/word1\b/)).not.toBeInTheDocument();
  });

  it('capture: shows the placeholder when no live caption text yet', () => {
    const flow = makeFlow({ view: 'capture', liveCaptionText: '' });
    render(<CenterStage flow={flow} sessionData={null} audioLevel={0} playback={mockPlayback} onOpenPalette={vi.fn()} />);
    expect(screen.getByText(/say something/i)).toBeInTheDocument();
  });

  it('processing: shows progress percentage', () => {
    const flow = makeFlow({ view: 'processing', processingProgress: 42 });
    render(<CenterStage flow={flow} sessionData={null} audioLevel={0} playback={mockPlayback} onOpenPalette={vi.fn()} />);
    expect(screen.getByText(/42%/)).toBeInTheDocument();
  });

  it('processing: Cancel button calls flow.cancelProcessing', () => {
    const flow = makeFlow({ view: 'processing', processingProgress: 10 });
    render(<CenterStage flow={flow} sessionData={null} audioLevel={0} playback={mockPlayback} onOpenPalette={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(flow.cancelProcessing).toHaveBeenCalled();
  });

  it('edit: renders the canvas preview once a session is loaded', () => {
    const flow = makeFlow({ view: 'edit', sessionId: 's1' });
    render(<CenterStage flow={flow} sessionData={{ sessionId: 's1' }} audioLevel={0} playback={mockPlayback} onOpenPalette={vi.fn()} />);
    expect(screen.getByTestId('canvas-preview')).toBeInTheDocument();
  });
});
