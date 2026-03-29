import { describe, it, expect, vi, type Mock } from 'vitest';
import { render } from '@testing-library/react';
import { SplashScreen } from '@/components/splash/SplashScreen';

vi.mock('@clerk/nextjs', () => ({
  useAuth: vi.fn(),
  useClerk: vi.fn(() => ({ openSignUp: vi.fn() })),
  useUser: vi.fn(() => ({ user: null })),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { useAuth, useClerk } from '@clerk/nextjs';

describe('SplashScreen', () => {
  it('shows spinner while Clerk is loading', () => {
    (useAuth as Mock).mockReturnValue({ isLoaded: false, isSignedIn: false });
    const { container } = render(<SplashScreen />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
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
});
