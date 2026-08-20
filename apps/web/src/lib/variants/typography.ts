/**
 * Type styles — headings, eyebrows, body copy and field labels.
 */

import { cva } from 'class-variance-authority';

/* ─────────────────────────────────────────────────────────────
 * Acid design system — bold consumer/expressive (see DESIGN.md).
 * New surfaces use these; existing components migrate over time.
 * ───────────────────────────────────────────────────────────── */

/**
 * Acid heading — Nunito display scale. Expressive hero type.
 *
 * Each `text-acid-*` token carries its own leading and tracking (defined in
 * globals.css via Tailwind v4's `--text-*--line-height` / `--letter-spacing`),
 * so size/leading/tracking always move together as one triple. Never add a
 * separate `leading-*` or `tracking-*` next to these — it decouples the pair.
 */
export const acidHeading = cva('font-acid-display font-semibold', {
  variants: {
    level: {
      display: 'text-acid-display',
      title: 'text-acid-title',
      headline: 'text-acid-headline',
    },
  },
  defaultVariants: { level: 'title' },
});

/**
 * Acid eyebrow — punchy uppercase label, replaces the old monospace eyebrow.
 * Uses the label size but the eyebrow's own tracking: all-caps has no
 * ascender/descender variation to separate glyphs, so its spacing is driven
 * by casing rather than size.
 */
export const acidEyebrow =
  'font-acid-body font-black text-acid-eyebrow uppercase text-acid-text-3';

/* ------------------------------------------------------------------ *
 * Static class strings — repeated enough to name.
 * ------------------------------------------------------------------ */

/** UPPERCASE structural label. Uses the ACID eyebrow tracking. */
export const ordSectionLabel =
  'text-[length:var(--acid-text-footnote)] font-semibold uppercase ' +
  'tracking-[var(--acid-tracking-eyebrow)] text-[color:var(--acid-text-3)]';

/** Row label — sentence case, the thing a control is named by. */
export const ordFieldLabel = 'text-[length:var(--text-caption)] font-semibold text-[color:var(--acid-text-2)]';

/** Secondary line under a field label. */
export const ordFieldHint =
  'text-[length:var(--text-footnote)] leading-tight text-[color:var(--acid-text-3)]';
