'use client';

import { useSyncExternalStore } from 'react';

/**
 * Subscribe to a CSS media query.
 *
 * This replaces the user-agent sniffing in `lib/deviceDetect.ts`, which decided
 * mobile-vs-desktop on the server and routed the two to entirely separate pages.
 * That split is why desktop silently fell behind mobile for months: nothing
 * imported anything shared, so no mobile change ever broke a desktop build.
 *
 * A viewport query is also simply more accurate. deviceDetect's own comment
 * admitted the flaw — iPadOS 13+ reports a desktop Safari UA, so an iPad got the
 * desktop workspace. Asking the viewport cannot be wrong about the viewport, and
 * a desktop window dragged narrow now gets the layout that actually fits it.
 *
 * Written against useSyncExternalStore rather than useState + useEffect because
 * that is what it is for: matchMedia is external state, and this gets tearing
 * safety and the SSR snapshot for free. A dependency (usehooks-ts et al) was
 * considered and rejected — this is twenty lines and the only consumer is the
 * layout switch.
 */
export function useMediaQuery(query: string, serverFallback = false): boolean {
  const subscribe = (onChange: () => void) => {
    // Guarded for jsdom and any environment without matchMedia; there the
    // server fallback stands and the hook is simply inert.
    if (typeof window === 'undefined' || !window.matchMedia) return () => {};
    const list = window.matchMedia(query);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  };

  const getSnapshot = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return serverFallback;
    return window.matchMedia(query).matches;
  };

  return useSyncExternalStore(subscribe, getSnapshot, () => serverFallback);
}

/**
 * The one breakpoint that decides which chrome the capture flow wears.
 *
 * 1024px is Tailwind's `lg`, so CSS written against `lg:` agrees with the
 * component that mounts. Keep them in step: a component-level switch that
 * disagreed with the utility classes inside it would be its own quiet bug.
 */
export const DESKTOP_QUERY = '(min-width: 1024px)';

export function useIsDesktopViewport(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
