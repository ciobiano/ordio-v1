import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { OnboardingScreen } from '@/components/splash/OnboardingScreen';

vi.mock('@/components/mobile/auth/OnboardingAuthTray', () => ({
  OnboardingAuthTray: () => <div data-testid="auth-tray-stub" />,
}));

describe('OnboardingScreen', () => {
  it('renders the pitch eyebrow', () => {
    const { getByText } = render(<OnboardingScreen />);
    expect(getByText(/record\. transcribe\. share\./i)).toBeInTheDocument();
  });

  it('renders the auth tray', () => {
    const { getByTestId } = render(<OnboardingScreen />);
    expect(getByTestId('auth-tray-stub')).toBeInTheDocument();
  });
});
