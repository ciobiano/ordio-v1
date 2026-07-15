import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimelineStrip } from '@/components/studio/TimelineStrip';
import { useCaptureStore } from '@/stores';

vi.mock('@Ordio/shared/waveform', () => ({
  waveformSampler: () => Array.from({ length: 150 }, (_, i) => (i % 10 === 0 ? 0.02 : 0.6)),
}));

describe('TimelineStrip', () => {
  beforeEach(() => {
    useCaptureStore.setState({ audioBuffer: null });
  });

  it('shows an empty hint when no audio is loaded', () => {
    render(<TimelineStrip currentTime={0} duration={0} onSeek={vi.fn()} />);
    expect(screen.getByText(/record or open a clip/i)).toBeInTheDocument();
  });

  it('renders the ruler and seeks on click-release when audio is loaded', () => {
    useCaptureStore.setState({ audioBuffer: {} as AudioBuffer });
    const onSeek = vi.fn();
    render(<TimelineStrip currentTime={10} duration={47} onSeek={onSeek} />);
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText('0:47')).toBeInTheDocument();

    const strip = screen.getByTestId('timeline-strip');
    vi.spyOn(strip, 'getBoundingClientRect').mockReturnValue({
      left: 0, right: 400, width: 400, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON: () => {},
    });
    fireEvent.pointerDown(strip, { clientX: 200 });
    fireEvent.pointerUp(strip, { clientX: 200 });
    expect(onSeek).toHaveBeenCalledWith(expect.closeTo(23.5, 1));
  });
});
