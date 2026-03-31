import { describe, it, expect, vi, type Mock } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SplashScreen } from '@/components/splash/SplashScreen';

vi.mock('@clerk/nextjs', () => ({
  useAuth: vi.fn(),
  useClerk: vi.fn(() => ({ openSignUp: vi.fn() })),
  useUser: vi.fn(() => ({ user: null })),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('@/components/NavigationTransition', () => ({
  useNavigate: () => ({ navigate: mockNavigate }),
  useOverlayLoading: vi.fn(),
}));

import { useAuth, useClerk } from '@clerk/nextjs';

describe('SplashScreen', () => {
  it('renders nothing while Clerk is loading (overlay handled by NavigationTransition)', () => {
    (useAuth as Mock).mockReturnValue({ isLoaded: false, isSignedIn: false });
    const { container } = render(<SplashScreen />);
    // Component returns null when auth is loading; loading UI is owned by NavigationTransition overlay
    expect(container.firstChild).toBeNull();
  });

  it('shows OnboardingCarousel when user is not signed in', () => {
    (useAuth as Mock).mockReturnValue({ isLoaded: true, isSignedIn: false });
    const { getByTestId } = render(<SplashScreen />);
    expect(getByTestId('carousel-container')).toBeInTheDocument();
  });

  it('shows SlideToContinue when user is signed in', () => {
    (useAuth as Mock).mockReturnValue({ isLoaded: true, isSignedIn: true });
    const { getByTestId } = render(<SplashScreen />);
    expect(getByTestId('slide-track')).toBeInTheDocument();
  });

  it('calls openSignUp when CTA is clicked in carousel', () => {
    const openSignUp = vi.fn();
    (useAuth as Mock).mockReturnValue({ isLoaded: true, isSignedIn: false });
    (useClerk as Mock).mockReturnValue({ openSignUp });
    const { getByRole } = render(<SplashScreen />);
    getByRole('button', { name: /get started/i }).click();
    expect(openSignUp).toHaveBeenCalledTimes(1);
  });

  it('calls navigate to /create when SlideToContinue onComplete fires', () => {
    mockNavigate.mockClear();
    (useAuth as Mock).mockReturnValue({ isLoaded: true, isSignedIn: true });
    const { getByTestId } = render(<SplashScreen />);
    const track = getByTestId('slide-track');
    // Track width 300px: THUMB_INSET=7, THUMB_SIZE=36, maxTravel = 300 - 36 - 14 = 250
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      left: 0, width: 300, top: 0, bottom: 0, right: 300, height: 0, x: 0, y: 0, toJSON: () => ({}),
    });
    // Start drag inside the thumb hit zone (7px to 47px), move > 85% of maxTravel (>212.5px)
    fireEvent.pointerDown(track, { clientX: 20, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 235, pointerId: 1 }); // delta=215 → 86% of 250
    fireEvent.pointerUp(track, { pointerId: 1 });
    expect(mockNavigate).toHaveBeenCalledWith('/create');
  });
});
