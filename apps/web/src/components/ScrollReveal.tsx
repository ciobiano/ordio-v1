'use client';

import { useEffect } from 'react';

const HIDE_AFTER_MS = 700;

/**
 * Shows a scrollbar only while its container is scrolling (ord-motion.css).
 *
 * One capture-phase listener on the document instead of a hook per list:
 * scroll events do not bubble, but they do pass through the capture phase, so
 * a single listener sees every scroll container — including ones rendered by
 * third-party components that could never have opted in.
 */
export function ScrollReveal() {
  useEffect(() => {
    const timers = new Map<Element, ReturnType<typeof setTimeout>>();

    const onScroll = (event: Event) => {
      const target =
        event.target instanceof Element ? event.target : document.scrollingElement;
      if (!target) return;
      target.classList.add('is-scrolling');
      const pending = timers.get(target);
      if (pending) clearTimeout(pending);
      timers.set(
        target,
        setTimeout(() => {
          target.classList.remove('is-scrolling');
          timers.delete(target);
        }, HIDE_AFTER_MS)
      );
    };

    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return null;
}
