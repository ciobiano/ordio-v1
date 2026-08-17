/**
 * The capture route serves every viewport from one URL.
 *
 * These tests exist because the bug they guard against produced no failures at
 * all. Desktop used to live at its own route, reached by a user-agent redirect,
 * sharing no components with mobile — so mobile could improve for months and
 * nothing on the desktop side would break, fail, or even warn. A silent
 * divergence needs an explicit assertion; there is no compiler for "these two
 * screens should stay in step".
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import {
  useMediaQuery,
  useIsDesktopViewport,
  DESKTOP_QUERY,
} from '@/hooks/useBreakpoint';

/**
 * jsdom does not implement matchMedia, so the hook's guard returns the server
 * fallback and every test would otherwise see the mobile branch. Installing a
 * stub is what makes the desktop branch reachable at all.
 */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  };
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(() => mql),
  });
  return {
    /** Flip the query result and notify, the way a real resize would. */
    set(next: boolean) {
      mql.matches = next;
      act(() => {
        listeners.forEach((cb) => cb());
      });
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

afterEach(() => {
  // Leave the environment as found — jsdom has no matchMedia by default, and a
  // leaked stub would quietly decide other suites' layout branches.
  Reflect.deleteProperty(window, 'matchMedia');
  vi.restoreAllMocks();
});

function Probe({ query }: { query: string }) {
  const matches = useMediaQuery(query);
  return <span data-testid="result">{String(matches)}</span>;
}

function DesktopProbe() {
  return <span data-testid="result">{String(useIsDesktopViewport())}</span>;
}

describe('useMediaQuery', () => {
  it('falls back to false where matchMedia does not exist', () => {
    // Not a defensive nicety — this is the path jsdom and SSR both take, and it
    // decides which chrome mounts, so it is asserted rather than assumed.
    expect(window.matchMedia).toBeUndefined();
    render(<Probe query="(min-width: 1024px)" />);
    expect(screen.getByTestId('result').textContent).toBe('false');
  });

  it('honours an explicit server fallback when matchMedia is absent', () => {
    function FallbackProbe() {
      return <span data-testid="fb">{String(useMediaQuery('(min-width: 1024px)', true))}</span>;
    }
    render(<FallbackProbe />);
    expect(screen.getByTestId('fb').textContent).toBe('true');
  });

  it('reports the current match', () => {
    stubMatchMedia(true);
    render(<Probe query="(min-width: 1024px)" />);
    expect(screen.getByTestId('result').textContent).toBe('true');
  });

  it('re-renders when the query starts matching', () => {
    const mm = stubMatchMedia(false);
    render(<Probe query="(min-width: 1024px)" />);
    expect(screen.getByTestId('result').textContent).toBe('false');

    mm.set(true);
    expect(screen.getByTestId('result').textContent).toBe('true');
  });

  it('unsubscribes on unmount', () => {
    const mm = stubMatchMedia(true);
    const { unmount } = render(<Probe query="(min-width: 1024px)" />);
    expect(mm.listenerCount).toBe(1);
    unmount();
    expect(mm.listenerCount).toBe(0);
  });
});

describe('DESKTOP_QUERY', () => {
  it("matches Tailwind's lg breakpoint", () => {
    // The component-level switch and the `lg:` utilities inside those components
    // have to agree. If this constant drifts from Tailwind's lg, a layout would
    // mount desktop chrome while its own classes still styled for mobile.
    expect(DESKTOP_QUERY).toBe('(min-width: 1024px)');
  });

  it('drives the desktop viewport hook', () => {
    const mm = stubMatchMedia(false);
    render(<DesktopProbe />);
    expect(screen.getByTestId('result').textContent).toBe('false');
    mm.set(true);
    expect(screen.getByTestId('result').textContent).toBe('true');
  });
});
