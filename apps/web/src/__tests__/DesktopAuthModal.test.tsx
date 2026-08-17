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
import { render, screen } from '@testing-library/react';
import { DesktopAuthModal } from '@/components/soul/auth/DesktopAuthModal';

vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({ openSignUp: vi.fn() }),
}));
vi.mock('@clerk/nextjs/legacy', () => ({
  useSignUp: () => ({ isLoaded: true, signUp: { authenticateWithRedirect: vi.fn() } }),
}));

describe('DesktopAuthModal', () => {
  it('is a labelled modal dialog', () => {
    render(<DesktopAuthModal />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(/sign in/i);
  });

  it('is a bounded card, not a full-bleed screen', () => {
    // The whole point. `max-w-*` on the card is what stops the auth buttons
    // spanning the viewport the way the mobile tray does.
    render(<DesktopAuthModal />);
    const card = screen.getByRole('dialog').firstElementChild;
    expect(card?.className).toMatch(/max-w-/);
  });

  it('offers the same three entry points as mobile', () => {
    render(<DesktopAuthModal />);
    expect(screen.getByRole('button', { name: /continue with apple/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with email/i })).toBeInTheDocument();
  });

  it('shows the real wordmark rather than a stand-in glyph', () => {
    render(<DesktopAuthModal />);
    expect(screen.getByText('Ordio')).toBeInTheDocument();
  });

  it('carries no gradient utility', () => {
    // The deleted version drew its logo on `linear-gradient(135deg,#C6FF3D,#6BE0FF)`
    // — two raw hexes for a colour --acid-accent already holds.
    const { container } = render(<DesktopAuthModal />);
    expect(container.innerHTML).not.toMatch(/gradient/i);
  });
});
