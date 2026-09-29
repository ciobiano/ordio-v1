import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { OnboardingScreen } from '@/components/splash/OnboardingScreen';

vi.mock('@/components/mobile/auth/OnboardingAuthTray', () => ({
  OnboardingAuthTray: () => <div data-testid="auth-tray-stub" />,
}));

// AnimatePresence mode="wait" holds the next slide until the exit finishes;
// render slides immediately so each step is assertable on its own.
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

beforeEach(() => {
  window.localStorage.clear();
});

describe('OnboardingScreen', () => {
  it('opens on the first welcome slide', () => {
    render(<OnboardingScreen />);
    expect(screen.getByRole('heading', { name: /turn voice notes into videos/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Step 1 of 3' })).toBeInTheDocument();
    expect(screen.queryByTestId('auth-tray-stub')).not.toBeInTheDocument();
  });

  it('walks the three slides and ends on sign-up', () => {
    render(<OnboardingScreen />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByRole('heading', { name: /every word, ?on time/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByRole('heading', { name: /pick a look, ?post anywhere/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    expect(screen.getByRole('heading', { name: /create an account/i })).toBeInTheDocument();
    expect(screen.getByTestId('auth-tray-stub')).toBeInTheDocument();
  });

  it('skips straight to sign-up', () => {
    render(<OnboardingScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByTestId('auth-tray-stub')).toBeInTheDocument();
  });

  it('opens on sign-up for someone who has already seen the slides', async () => {
    window.localStorage.setItem('ordio:onboarding-seen', '1');
    await act(async () => {
      render(<OnboardingScreen />);
    });
    expect(screen.getByTestId('auth-tray-stub')).toBeInTheDocument();
  });
});
