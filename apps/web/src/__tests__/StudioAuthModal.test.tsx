import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { StudioAuthModal } from '@/components/soul/auth/StudioAuthModal';

vi.mock('@/components/soul/auth/OnboardingAuthTray', () => ({
  OnboardingAuthTray: () => <div data-testid="auth-tray-stub" />,
}));

vi.mock('@/hooks/useTypewriter', () => ({
  useTypewriter: () => ({ text: "Let's record", isPhraseComplete: false }),
}));

describe('StudioAuthModal', () => {
  it('renders nothing when closed', () => {
    const { queryByRole } = render(<StudioAuthModal open={false} />);
    expect(queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the auth tray when open', () => {
    const { getByRole, getByTestId } = render(<StudioAuthModal open />);
    expect(getByRole('dialog')).toBeInTheDocument();
    expect(getByTestId('auth-tray-stub')).toBeInTheDocument();
  });
});
