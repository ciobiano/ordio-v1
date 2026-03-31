import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { OnboardingCarousel } from '@/components/splash/OnboardingCarousel';

describe('OnboardingCarousel', () => {
  it('renders slide 1 content by default', () => {
    const { getByText } = render(<OnboardingCarousel onCTA={() => {}} />);
    expect(getByText(/record\. transcribe\. share\./i)).toBeInTheDocument();
    expect(getByText(/shareable story/i)).toBeInTheDocument();
  });

  it('advances to slide 2 on left swipe', () => {
    const { getByTestId, getByText } = render(
      <OnboardingCarousel onCTA={() => {}} />
    );
    const carousel = getByTestId('carousel-container');
    fireEvent.touchStart(carousel, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 120 }] }); // delta -80
    expect(getByText(/time-stamped/i)).toBeInTheDocument();
  });

  it('does not go before slide 1 on right swipe from slide 1', () => {
    const { getByText, getByTestId } = render(<OnboardingCarousel onCTA={() => {}} />);
    const carousel = getByTestId('carousel-container');
    fireEvent.touchStart(carousel, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 200 }] }); // delta +100
    expect(getByText(/record\. transcribe\. share\./i)).toBeInTheDocument(); // still slide 1
  });

  it('does not advance past slide 3 on left swipe from slide 3', () => {
    const { getByTestId, getByText } = render(<OnboardingCarousel onCTA={() => {}} />);
    const carousel = getByTestId('carousel-container');
    // Advance to slide 3
    fireEvent.touchStart(carousel, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 120 }] });
    fireEvent.touchStart(carousel, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 120 }] });
    // Try to advance past slide 3
    fireEvent.touchStart(carousel, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 120 }] });
    expect(getByText(/actually look good/i)).toBeInTheDocument(); // still slide 3
  });

  it('calls onCTA when Get Started is tapped', () => {
    const onCTA = vi.fn();
    const { getByRole } = render(<OnboardingCarousel onCTA={onCTA} />);
    fireEvent.click(getByRole('button', { name: /get started/i }));
    expect(onCTA).toHaveBeenCalledTimes(1);
  });

  it('renders 3 dash indicators with the correct one active', () => {
    const { getAllByTestId } = render(<OnboardingCarousel onCTA={() => {}} />);
    const dashes = getAllByTestId('progress-dash');
    expect(dashes).toHaveLength(3);
    expect(dashes[0]).toHaveAttribute('data-active', 'true');
    expect(dashes[1]).toHaveAttribute('data-active', 'false');
    expect(dashes[2]).toHaveAttribute('data-active', 'false');
  });
});
