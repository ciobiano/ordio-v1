import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CenterStage } from '@/components/studio/CenterStage';
import type { UseStudioFlowReturn } from '@/hooks/studio/useStudioFlow';

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
});
