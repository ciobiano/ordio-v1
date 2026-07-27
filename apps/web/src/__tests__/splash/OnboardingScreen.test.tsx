import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { OnboardingScreen } from '@/components/splash/OnboardingScreen';

vi.mock('@/components/soul/auth/OnboardingAuthTray', () => ({
  OnboardingAuthTray: () => <div data-testid="auth-tray-stub" />,
}));

vi.mock('@/hooks/useTypewriter', () => ({
  useTypewriter: vi.fn(),
}));

import { useTypewriter } from '@/hooks/useTypewriter';
import type { Mock } from 'vitest';

describe('OnboardingScreen', () => {
  it('renders the currently typed phrase', () => {
    (useTypewriter as Mock).mockReturnValue({ text: "Let's rec", isPhraseComplete: false });
    const { getByText } = render(<OnboardingScreen />);
    expect(getByText("Let's rec")).toBeInTheDocument();
  });

  it('keeps the pitch eyebrow visible while the headline cycles', () => {
    (useTypewriter as Mock).mockReturnValue({ text: 'Post your voice', isPhraseComplete: true });
    const { getByText } = render(<OnboardingScreen />);
    expect(getByText(/record\. transcribe\. share\./i)).toBeInTheDocument();
  });

  it('renders the auth tray', () => {
    (useTypewriter as Mock).mockReturnValue({ text: '', isPhraseComplete: false });
    const { getByTestId } = render(<OnboardingScreen />);
    expect(getByTestId('auth-tray-stub')).toBeInTheDocument();
  });
});
