import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimelineStrip } from '@/components/studio/TimelineStrip';

describe('TimelineStrip', () => {
  it('renders formatted start/end time and seeks on click', () => {
    const onSeek = vi.fn();
    render(<TimelineStrip currentTime={10} duration={47} onSeek={onSeek} />);
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText('0:47')).toBeInTheDocument();

    const strip = screen.getByTestId('timeline-strip');
    vi.spyOn(strip, 'getBoundingClientRect').mockReturnValue({
      left: 0, right: 400, width: 400, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON: () => {},
    });
    fireEvent.pointerDown(strip, { clientX: 200 });
    expect(onSeek).toHaveBeenCalledWith(expect.closeTo(23.5, 1));
  });
});
