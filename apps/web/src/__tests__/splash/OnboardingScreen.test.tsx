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
  it('renders the currently typed phrase without the audio icon mid-type', () => {
    (useTypewriter as Mock).mockReturnValue({ text: "Let's rec", isPhraseComplete: false });
    const { getByText, container } = render(<OnboardingScreen />);
    expect(getByText("Let's rec")).toBeInTheDocument();
    // Audio icon only reveals once the phrase finishes typing
    expect(container.querySelector('.audio-orb-icon')).not.toBeInTheDocument();
  });

  it('reveals the audio orb icon once the phrase finishes typing', () => {
    (useTypewriter as Mock).mockReturnValue({ text: "Let's record", isPhraseComplete: true });
    const { container } = render(<OnboardingScreen />);
    expect(container.querySelector('.audio-orb-icon')).toBeInTheDocument();
  });

  it('renders the auth tray', () => {
    (useTypewriter as Mock).mockReturnValue({ text: '', isPhraseComplete: false });
    const { getByTestId } = render(<OnboardingScreen />);
    expect(getByTestId('auth-tray-stub')).toBeInTheDocument();
  });
});
