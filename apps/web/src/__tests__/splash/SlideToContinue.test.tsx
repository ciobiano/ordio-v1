import { render, fireEvent } from '@testing-library/react';
import { SlideToContinue } from '@/components/splash/SlideToContinue';

describe('SlideToContinue', () => {
  it('calls onComplete when thumb is dragged past 85% of track width', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(
      <SlideToContinue onComplete={onComplete} userName="Ralph" />
    );
    const thumb = getByTestId('slide-thumb');
    const track = getByTestId('slide-track');

    jest.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      left: 0, width: 200, top: 0, bottom: 0, right: 200, height: 0, x: 0, y: 0, toJSON: () => ({})
    });

    fireEvent.pointerDown(thumb, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(thumb, { clientX: 175, pointerId: 1 }); // 87.5% > 85%
    fireEvent.pointerUp(thumb, { pointerId: 1 });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onComplete when released below 85% threshold', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(
      <SlideToContinue onComplete={onComplete} userName="Ralph" />
    );
    const thumb = getByTestId('slide-thumb');
    const track = getByTestId('slide-track');

    jest.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      left: 0, width: 200, top: 0, bottom: 0, right: 200, height: 0, x: 0, y: 0, toJSON: () => ({})
    });

    fireEvent.pointerDown(thumb, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(thumb, { clientX: 100, pointerId: 1 }); // 50% < 85%
    fireEvent.pointerUp(thumb, { pointerId: 1 });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('renders the userName when provided', () => {
    const { getByText } = render(
      <SlideToContinue onComplete={() => {}} userName="Ralph" />
    );
    expect(getByText(/ralph/i)).toBeInTheDocument();
  });
});
