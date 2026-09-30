/**
 * The desktop sign-in gate is a centred modal, not the mobile splash.
 *
 * Worth asserting because the mistake it guards against already happened twice in
 * one session: the modal was deleted for its contents (a hardcoded lime-to-cyan
 * gradient tile and a 22-second typewriter) rather than its layout, which left
 * desktop rendering the phone-shaped splash stretched to 1670px. Nothing failed —
 * the splash renders perfectly well at any width, it just looks wrong.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DesktopAuthModal } from '@/components/mobile/auth/DesktopAuthModal';

const openSignUp = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({ openSignUp, openSignIn: vi.fn() }),
}));
vi.mock('@clerk/nextjs/legacy', () => ({
  useSignUp: () => ({ isLoaded: true, signUp: { authenticateWithRedirect: vi.fn() } }),
}));

describe('DesktopAuthModal', () => {
  it('is a labelled modal dialog', () => {
    render(<DesktopAuthModal />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(/create an account/i);
  });

  it('is a bounded card, not a full-bleed screen', () => {
    // The whole point. `max-w-*` on the card is what stops the auth buttons
    // spanning the viewport the way the mobile tray does.
    render(<DesktopAuthModal />);
    expect(screen.getByRole('dialog').className).toMatch(/max-w-/);
  });

  it('offers the same entry points as mobile', () => {
    render(<DesktopAuthModal />);
    expect(screen.getByRole('button', { name: /continue with apple/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('hands the typed email to Clerk so nobody types it twice', () => {
    render(<DesktopAuthModal />);
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'ada@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(openSignUp).toHaveBeenCalledWith({ initialValues: { emailAddress: 'ada@example.com' } });
  });

  it('carries the onboarding slides as a carousel', () => {
    render(<DesktopAuthModal />);
    expect(screen.getByRole('heading', { name: /turn voice notes into videos/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('tab', { name: 'Step 2 of 3' })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the real wordmark rather than a stand-in glyph', () => {
    render(<DesktopAuthModal />);
    expect(screen.getByText('Ordio')).toBeInTheDocument();
  });

  it('never draws the old lime-to-cyan stand-in logo', () => {
    // The deleted version drew its logo on `linear-gradient(135deg,#C6FF3D,#6BE0FF)`
    // — two raw hexes for a colour --acid-accent already holds.
    const { container } = render(<DesktopAuthModal />);
    expect(container.innerHTML).not.toMatch(/#6BE0FF/i);
  });
});
