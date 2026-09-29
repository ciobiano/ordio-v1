/**
 * The shared auth tray — mobile onboarding and the desktop modal both render it.
 *
 * Two groups of tests here. The wiring group predates the pending state and
 * covers what each control actually does. The pending group is newer: pressing a
 * provider used to change nothing on screen, because `authenticateWithRedirect`
 * has to reach Clerk before the browser navigates, and for that whole round trip
 * the tray looked idle. The button read as broken, so the natural response was to
 * press it again — or reach for the other provider — starting a second handoff
 * over the first.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OnboardingAuthTray } from '@/components/mobile/auth/OnboardingAuthTray';

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

const apple = () => screen.getByRole('button', { name: 'Continue with Apple' });
const google = () => screen.getByRole('button', { name: 'Continue with Google' });
/** The email route: a field, then Continue, which opens Clerk's sign-up. */
const email = () => screen.getByRole('button', { name: /^continue$/i });
const emailField = () => screen.getByLabelText(/email address/i);

/** The window between the press and the redirect — never settles. */
const inFlight = () => authenticateWithRedirect.mockImplementation(() => new Promise(() => {}));
const failing = () =>
  authenticateWithRedirect.mockImplementation(() => Promise.reject(new Error('handoff failed')));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OnboardingAuthTray wiring', () => {
  it('calls openSignUp for Continue', () => {
    render(<OnboardingAuthTray redirectUrlComplete="/create" />);
    fireEvent.click(email());
    expect(openSignUp).toHaveBeenCalledTimes(1);
  });

  it('hands a typed email to Clerk so it is not typed twice', () => {
    render(<OnboardingAuthTray redirectUrlComplete="/create" />);
    fireEvent.change(emailField(), { target: { value: '  ada@example.com ' } });
    fireEvent.click(email());
    expect(openSignUp).toHaveBeenCalledWith({ initialValues: { emailAddress: 'ada@example.com' } });
  });

  it('opens sign-in for Log in', () => {
    render(<OnboardingAuthTray redirectUrlComplete="/create" />);
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(openSignIn).toHaveBeenCalledTimes(1);
  });

  it('starts an Apple OAuth redirect with the given completion URL', () => {
    render(<OnboardingAuthTray redirectUrlComplete="/somewhere" />);
    fireEvent.click(apple());
    expect(authenticateWithRedirect).toHaveBeenCalledWith({
      strategy: 'oauth_apple',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/somewhere',
    });
  });

  it('starts a Google OAuth redirect', () => {
    render(<OnboardingAuthTray redirectUrlComplete="/create" />);
    fireEvent.click(google());
    expect(authenticateWithRedirect).toHaveBeenCalledWith({
      strategy: 'oauth_google',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/create',
    });
  });

  it('does nothing for OAuth buttons while signUp is not yet loaded', () => {
    (useSignUp as Mock).mockReturnValueOnce({ isLoaded: false, signUp: undefined });
    render(<OnboardingAuthTray redirectUrlComplete="/create" />);
    fireEvent.click(apple());
    expect(authenticateWithRedirect).not.toHaveBeenCalled();
  });

  it('does not strand the tray disabled when the press is a no-op', () => {
    // `isLoaded` is false, so nothing was started — the tray must stay usable
    // rather than latch into a pending state with no handoff to wait for.
    (useSignUp as Mock).mockReturnValueOnce({ isLoaded: false, signUp: undefined });
    render(<OnboardingAuthTray redirectUrlComplete="/create" />);
    fireEvent.click(apple());
    expect(apple()).toBeEnabled();
    expect(google()).toBeEnabled();
  });
});

describe('OnboardingAuthTray pending state', () => {
  it('starts with every entry point enabled', () => {
    inFlight();
    render(<OnboardingAuthTray redirectUrlComplete="/create" />);
    expect(apple()).toBeEnabled();
    expect(google()).toBeEnabled();
    expect(email()).toBeEnabled();
  });

  it('marks the pressed provider busy', async () => {
    inFlight();
    render(<OnboardingAuthTray redirectUrlComplete="/create" />);
    fireEvent.click(apple());
    await waitFor(() => expect(apple()).toHaveAttribute('aria-busy', 'true'));
    expect(google()).toHaveAttribute('aria-busy', 'false');
  });

  it('disables the whole tray so a second handoff cannot start', async () => {
    inFlight();
    render(<OnboardingAuthTray redirectUrlComplete="/create" />);
    fireEvent.click(apple());
    await waitFor(() => expect(apple()).toBeDisabled());
    // The other provider is the real hazard: a user who thinks Apple failed
    // reaches for Google, and two redirects race.
    expect(google()).toBeDisabled();
    expect(email()).toBeDisabled();
    expect(emailField()).toBeDisabled();
  });

  it('ignores repeat presses instead of starting a second handoff', async () => {
    inFlight();
    render(<OnboardingAuthTray redirectUrlComplete="/create" />);
    fireEvent.click(apple());
    await waitFor(() => expect(authenticateWithRedirect).toHaveBeenCalledTimes(1));
    fireEvent.click(apple());
    fireEvent.click(apple());
    fireEvent.click(google());
    expect(authenticateWithRedirect).toHaveBeenCalledTimes(1);
  });

  it('does not open the email modal while a provider is pending', async () => {
    inFlight();
    render(<OnboardingAuthTray redirectUrlComplete="/create" />);
    fireEvent.click(google());
    await waitFor(() => expect(email()).toBeDisabled());
    fireEvent.click(email());
    expect(openSignUp).not.toHaveBeenCalled();
  });

  it('re-enables the tray when the handoff fails', async () => {
    failing();
    render(<OnboardingAuthTray redirectUrlComplete="/create" />);
    fireEvent.click(apple());
    // A success navigates away, so failure is the only path back to an
    // interactive tray. If it did not reset, one transient error would lock the
    // user out of signing in entirely.
    await waitFor(() => expect(apple()).toBeEnabled());
    expect(google()).toBeEnabled();
    expect(email()).toBeEnabled();
  });

  it('allows a retry after a failure', async () => {
    failing();
    render(<OnboardingAuthTray redirectUrlComplete="/create" />);
    fireEvent.click(apple());
    await waitFor(() => expect(apple()).toBeEnabled());
    fireEvent.click(apple());
    await waitFor(() => expect(authenticateWithRedirect).toHaveBeenCalledTimes(2));
  });
});
