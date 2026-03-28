import { render, fireEvent } from '@testing-library/react';
import { SlideToContinue } from '@/components/splash/SlideToContinue';

describe('SlideToContinue', () => {
  it('calls onComplete when thumb is dragged past 85% of track width', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(
      <SlideToContinue onComplete={onComplete} userName="Ralph" />
    );
    const track = getByTestId('slide-track');

    jest.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      left: 0, width: 200, top: 0, bottom: 0, right: 200, height: 0, x: 0, y: 0, toJSON: () => ({})
    });

    // clientX: 10 is within the thumb hit area (thumb starts at x=7, tolerance ±4 → [3, 47])
    // startX=10, move to clientX=185 → delta=175, maxTravel=200-36-14=150, progress=175/150=1.0 → complete
    fireEvent.pointerDown(track, { clientX: 10, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 185, pointerId: 1 });
    fireEvent.pointerUp(track, { pointerId: 1 });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onComplete when released below 85% threshold', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(
      <SlideToContinue onComplete={onComplete} userName="Ralph" />
    );
    const track = getByTestId('slide-track');

    jest.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      left: 0, width: 200, top: 0, bottom: 0, right: 200, height: 0, x: 0, y: 0, toJSON: () => ({})
    });

    fireEvent.pointerDown(track, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 100, pointerId: 1 }); // 50% < 85%
    fireEvent.pointerUp(track, { pointerId: 1 });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('renders the userName when provided', () => {
    const { getByText } = render(
      <SlideToContinue onComplete={() => {}} userName="Ralph" />
    );
    expect(getByText(/ralph/i)).toBeInTheDocument();
  });
});
