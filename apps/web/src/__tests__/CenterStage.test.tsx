import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CenterStage } from '@/components/studio/CenterStage';
import type { UseStudioFlowReturn } from '@/hooks/studio/useStudioFlow';

vi.mock('@/hooks/playback/usePlayback', () => ({
  usePlayback: () => ({
    isPlaying: false,
    currentTime: 0,
    duration: 47,
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    load: vi.fn(),
  }),
}));
vi.mock('@/components/primitives/video/CanvasPreview', () => ({
  default: () => <div data-testid="canvas-preview" />,
}));
vi.mock('@/stores', () => ({
  useUIStore: (selector: (s: { format: string; waveformStyle: string; captionMode: string }) => unknown) =>
    selector({ format: 'vertical', waveformStyle: 'bars', captionMode: 'karaoke' }),
}));

function makeFlow(overrides: Partial<UseStudioFlowReturn>): UseStudioFlowReturn {
  return {
    view: 'idle',
    sessionId: null,
    recordingTime: 0,
    processingProgress: 0,
    transcript: [],
    isStarting: false,
    micDenied: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    openClip: vi.fn(),
    goIdle: vi.fn(),
    goExport: vi.fn(),
    getAudioLevel: vi.fn(() => 0),
    ...overrides,
  };
}

describe('CenterStage', () => {
  it('idle: shows the record orb and calls startRecording on click', () => {
    const flow = makeFlow({ view: 'idle' });
    render(<CenterStage flow={flow} sessionData={null} audioLevel={0} />);
    fireEvent.click(screen.getByRole('button', { name: /tap to record/i }));
    expect(flow.startRecording).toHaveBeenCalled();
  });

  it('capture: shows recording timer and calls stopRecording on click', () => {
    const flow = makeFlow({ view: 'capture', recordingTime: 12 });
    render(<CenterStage flow={flow} sessionData={null} audioLevel={0} />);
    expect(screen.getByText(/recording/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /stop recording/i }));
    expect(flow.stopRecording).toHaveBeenCalled();
  });

  it('processing: shows progress percentage', () => {
    const flow = makeFlow({ view: 'processing', processingProgress: 42 });
    render(<CenterStage flow={flow} sessionData={null} audioLevel={0} />);
    expect(screen.getByText(/42%/)).toBeInTheDocument();
  });

  it('edit: renders the canvas preview once a session is loaded', () => {
    const flow = makeFlow({ view: 'edit', sessionId: 's1' });
    render(<CenterStage flow={flow} sessionData={{ sessionId: 's1' }} audioLevel={0} />);
    expect(screen.getByTestId('canvas-preview')).toBeInTheDocument();
  });
});
