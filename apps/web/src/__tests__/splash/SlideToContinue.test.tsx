import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SlideToContinue } from '@/components/splash/SlideToContinue';

describe('SlideToContinue', () => {
  it('calls onComplete when thumb is dragged past 85% of track width', () => {
    const onComplete = vi.fn();
    const { getByTestId } = render(
      <SlideToContinue onComplete={onComplete} />
    );
    const track = getByTestId('slide-track');

    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      left: 0, width: 200, top: 0, bottom: 0, right: 200, height: 0, x: 0, y: 0, toJSON: () => ({})
    });

    fireEvent.pointerDown(track, { clientX: 10, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 185, pointerId: 1 });
    fireEvent.pointerUp(track, { pointerId: 1 });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onComplete when released below 85% threshold', () => {
    const onComplete = vi.fn();
    const { getByTestId } = render(
      <SlideToContinue onComplete={onComplete} />
    );
    const track = getByTestId('slide-track');

    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      left: 0, width: 200, top: 0, bottom: 0, right: 200, height: 0, x: 0, y: 0, toJSON: () => ({})
    });

    fireEvent.pointerDown(track, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 100, pointerId: 1 });
    fireEvent.pointerUp(track, { pointerId: 1 });

    expect(onComplete).not.toHaveBeenCalled();
  });
});
