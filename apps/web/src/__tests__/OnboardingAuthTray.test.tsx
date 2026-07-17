import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { OnboardingAuthTray } from '@/components/soul/auth/OnboardingAuthTray';

const openSignUp = vi.fn();
const openSignIn = vi.fn();
const authenticateWithRedirect = vi.fn();

vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({ openSignUp, openSignIn }),
}));

vi.mock('@clerk/nextjs/legacy', () => ({
  useSignUp: vi.fn(() => ({ isLoaded: true, signUp: { authenticateWithRedirect } })),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import { useSignUp } from '@clerk/nextjs/legacy';

describe('OnboardingAuthTray', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls openSignUp for Sign up', () => {
    const { getByRole } = render(<OnboardingAuthTray redirectUrlComplete="/create" />);
    fireEvent.click(getByRole('button', { name: 'Sign up' }));
    expect(openSignUp).toHaveBeenCalledTimes(1);
  });

  it('calls openSignIn for Log in', () => {
    const { getByRole } = render(<OnboardingAuthTray redirectUrlComplete="/create" />);
    fireEvent.click(getByRole('button', { name: 'Log in' }));
    expect(openSignIn).toHaveBeenCalledTimes(1);
  });

  it('starts an Apple OAuth redirect with the given completion URL', () => {
    const { getByRole } = render(<OnboardingAuthTray redirectUrlComplete="/studio" />);
    fireEvent.click(getByRole('button', { name: 'Continue with Apple' }));
    expect(authenticateWithRedirect).toHaveBeenCalledWith({
      strategy: 'oauth_apple',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/studio',
    });
  });

  it('starts a Google OAuth redirect', () => {
    const { getByRole } = render(<OnboardingAuthTray redirectUrlComplete="/create" />);
    fireEvent.click(getByRole('button', { name: 'Continue with Google' }));
    expect(authenticateWithRedirect).toHaveBeenCalledWith({
      strategy: 'oauth_google',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/create',
    });
  });

  it('does nothing for OAuth buttons while signUp is not yet loaded', () => {
    (useSignUp as Mock).mockReturnValueOnce({ isLoaded: false, signUp: undefined });
    const { getByRole } = render(<OnboardingAuthTray redirectUrlComplete="/create" />);
    fireEvent.click(getByRole('button', { name: 'Continue with Apple' }));
    expect(authenticateWithRedirect).not.toHaveBeenCalled();
  });
});
