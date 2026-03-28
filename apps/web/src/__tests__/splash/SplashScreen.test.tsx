import { render } from '@testing-library/react';
import { SplashScreen } from '@/components/splash/SplashScreen';

jest.mock('@clerk/nextjs', () => ({
  useAuth: jest.fn(),
  useClerk: jest.fn(() => ({ openSignUp: jest.fn() })),
  useUser: jest.fn(() => ({ user: null })),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

import { useAuth, useClerk } from '@clerk/nextjs';

describe('SplashScreen', () => {
  it('shows spinner while Clerk is loading', () => {
    (useAuth as jest.Mock).mockReturnValue({ isLoaded: false, isSignedIn: false });
    const { container } = render(<SplashScreen />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows OnboardingCarousel when user is not signed in', () => {
    (useAuth as jest.Mock).mockReturnValue({ isLoaded: true, isSignedIn: false });
    const { getByTestId } = render(<SplashScreen />);
    expect(getByTestId('carousel-container')).toBeInTheDocument();
  });

  it('shows SlideToContinue when user is signed in', () => {
    (useAuth as jest.Mock).mockReturnValue({ isLoaded: true, isSignedIn: true });
    const { getByTestId } = render(<SplashScreen />);
    expect(getByTestId('slide-track')).toBeInTheDocument();
  });

  it('calls openSignUp when CTA is clicked in carousel', () => {
    const openSignUp = jest.fn();
    (useAuth as jest.Mock).mockReturnValue({ isLoaded: true, isSignedIn: false });
    (useClerk as jest.Mock).mockReturnValue({ openSignUp });
    const { getByRole } = render(<SplashScreen />);
    getByRole('button', { name: /get started/i }).click();
    expect(openSignUp).toHaveBeenCalledTimes(1);
  });
});
