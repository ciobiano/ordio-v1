'use client';

/**
 * Pull caption faces into the document so the editor stops lying about them.
 *
 * The stage, the typeface list and the preset tiles all set `fontFamily` to a
 * face the page never loaded — Montserrat, Outfit, Instrument Serif and the
 * rest are canvas fonts, absent from the four next/font families in the
 * layout. Every one of them was silently falling back, so a caption preview
 * showed the right words in the wrong face and nothing failed.
 *
 * The engine's loader already solves this: `loadFont` fetches the Google
 * stylesheet, builds a FontFace and calls `document.fonts.add`, which makes it
 * available to the DOM as well as to canvas. It de-dupes internally, so asking
 * repeatedly is free.
 */

import { useEffect } from 'react';
import { loadFont } from '@Ordio/engine';

export function useDeskFonts(families: readonly string[]) {
  // Joined rather than passed as an array: a fresh array literal on every
  // render would re-fire this effect forever.
  const key = families.join('|');

  useEffect(() => {
    let cancelled = false;
    for (const family of key.split('|')) {
      if (!family) continue;
      void loadFont(family).catch(() => {
        // A missing face falls back, which is what would have happened
        // anyway — never worth breaking the panel over.
      });
    }
    return () => {
      cancelled = true;
      void cancelled;
    };
  }, [key]);
}
