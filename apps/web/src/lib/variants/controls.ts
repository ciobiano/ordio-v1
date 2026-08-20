/**
 * Stateful inputs: segments, toggles, chips, pills, option cards.
 */

import { cva, type VariantProps } from 'class-variance-authority';

/**
 * CVA variants for the export-screen redesign.
 *
 * Built on the existing ACID design system (`--acid-*` in globals.css), not on
 * a parallel palette. The Claude Design handoff shipped its own `--ord-*` token
 * set; every colour in it maps onto something ACID already has, so the mapping
 * is applied here rather than importing a rival scale:
 *
 *   handoff              →  ACID
 *   --ord-acid           →  --acid-accent          (the signature lime)
 *   --ord-acid @14%      →  --acid-accent-soft
 *   --ord-ink            →  --acid-bg-base / --acid-on-accent
 *   --ord-paper          →  --acid-text-1
 *   --ord-text-body      →  --acid-text-2
 *   --ord-text-muted     →  --acid-text-3
 *   --ord-surface-raised →  --acid-surface-2
 *   --ord-surface-card   →  --acid-surface-3
 *   --ord-border-hairline→  --acid-border-default
 *   --ord-rose           →  --acid-premium         (aliases --acid-warning)
 *
 * Only three things had no ACID equivalent and were added to the ACID block:
 * the sticker shadows, the snap/overshoot easings, and the `--acid-premium`
 * role for gated features.
 *
 * Kept out of `variants.ts` because that file is already 421 lines; this is a
 * self-contained set for one screen.
 *
 * House rules encoded here:
 *   - Press = translate 3px into your own shadow, shadow disappears. Not a dim.
 *   - Disabled = opacity 0.4. The only place opacity signals state.
 *   - Focus = accent ring, no offset.
 */

/* ------------------------------------------------------------------ *
 * Segmented control — Templates backdrop, Alignment, Capitalization,
 * Position. A pill track holding equal-width pill buttons.
 * ------------------------------------------------------------------ */

export const ordSegmentTrack = 'flex gap-1.5 p-1 rounded-full bg-white/[0.07]';

export const ordSegmentBtn = cva(
  'flex-1 rounded-full border-0 cursor-pointer font-semibold uppercase ' +
    'transition-colors duration-[var(--acid-dur-tap)] ease-[var(--acid-ease-snap)] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--acid-accent-ring)]',
  {
    variants: {
      size: {
        /** 34px — Alignment, Position, Capitalization */
        md: 'h-[34px] text-xs tracking-[0.06em]',
        /** 32px — Templates backdrop switcher */
        sm: 'h-8 text-xs tracking-[0.06em]',
      },
      active: {
        true: 'bg-[color:var(--acid-accent)] text-[color:var(--acid-on-accent)]',
        false: 'bg-transparent text-[color:var(--acid-text-3)] hover:text-[color:var(--acid-text-2)]',
      },
    },
    defaultVariants: { size: 'md', active: false },
  }
);

/* ------------------------------------------------------------------ *
 * Labelled toggle — active-word background, caption background, auto fit,
 * hide auto punctuation, apply-to-all.
 * ------------------------------------------------------------------ */

export const ordToggleTrack = cva(
  'flex items-center p-0.5 cursor-pointer shrink-0 rounded-full ' +
    'border-2 border-[color:var(--acid-bg-base)] ' +
    'transition-colors duration-[var(--acid-dur-snap)] ease-[var(--acid-ease-snap)] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--acid-accent-ring)]',
  {
    variants: {
      size: {
        /** 46×26 — the standard row toggle */
        md: 'w-[46px] h-[26px]',
        /** 42×24 — the tighter Colors-tab toggle that sits beside a swatch */
        sm: 'w-[42px] h-6',
      },
      on: {
        true: 'bg-[color:var(--acid-accent)] justify-end',
        false: 'bg-white/[0.18] justify-start',
      },
    },
    defaultVariants: { size: 'md', on: false },
  }
);

export const ordToggleThumb = cva('block rounded-full bg-[color:var(--acid-bg-base)]', {
  variants: {
    size: { md: 'w-[18px] h-[18px]', sm: 'w-4 h-4' },
  },
  defaultVariants: { size: 'md' },
});

/* ------------------------------------------------------------------ *
 * Option card — Motion rows, Visual rows, Font tiles.
 * ------------------------------------------------------------------ */

export const ordOptionCard = cva(
  'relative text-left cursor-pointer border-2 ' +
    'transition-colors duration-[var(--acid-dur-tap)] ease-[var(--acid-ease-snap)] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--acid-accent-ring)] ' +
    'disabled:opacity-40 disabled:cursor-not-allowed',
  {
    variants: {
      layout: {
        /** Motion / Visual — row with a trailing check pill */
        row: 'flex items-center gap-3 px-3.5 py-3 rounded-2xl min-h-11',
        /** Font — 2-col grid tile stacking name over its semantic label */
        tile: 'flex flex-col gap-0.5 px-3 py-2.5 rounded-[14px] min-h-11',
      },
      active: {
        true: 'bg-[color:var(--acid-accent-soft)] border-[color:var(--acid-accent)]',
        false: 'bg-white/[0.05] border-transparent hover:bg-white/[0.08]',
      },
    },
    defaultVariants: { layout: 'row', active: false },
  }
);

/** Trailing circular checkmark. Fades rather than unmounts so the row height
 *  never shifts between states. */
export const ordCheckPill = cva(
  'flex items-center justify-center shrink-0 rounded-full ' +
    'text-[color:var(--acid-on-accent)] transition-opacity duration-[var(--acid-dur-tap)]',
  {
    variants: {
      size: { md: 'w-6 h-6', sm: 'w-[22px] h-[22px]' },
      active: {
        true: 'bg-[color:var(--acid-accent)] opacity-100',
        false: 'bg-white/[0.08] opacity-0',
      },
    },
    defaultVariants: { size: 'md', active: false },
  }
);

/* ------------------------------------------------------------------ *
 * Chip — Breaks frequency, Breaks quantity, detected pauses.
 * ------------------------------------------------------------------ */

export const ordChip = cva(
  'shrink-0 h-[42px] px-4 cursor-pointer whitespace-nowrap border-2 rounded-xl ' +
    'font-semibold text-[length:var(--text-caption)] ' +
    'transition-colors duration-[var(--acid-dur-tap)] ease-[var(--acid-ease-snap)] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--acid-accent-ring)]',
  {
    variants: {
      tone: { default: '', danger: '' },
      active: { true: '', false: '' },
    },
    compoundVariants: [
      {
        tone: 'default',
        active: true,
        class:
          'bg-[color:var(--acid-accent)] text-[color:var(--acid-on-accent)] border-[color:var(--acid-bg-base)]',
      },
      {
        tone: 'default',
        active: false,
        class: 'bg-white/[0.07] text-[color:var(--acid-text-1)] border-transparent hover:bg-white/[0.10]',
      },
      {
        tone: 'danger',
        active: true,
        class:
          'bg-[color:var(--acid-error)]/15 text-[color:var(--acid-error)] border-[color:var(--acid-error)] line-through opacity-60',
      },
      {
        tone: 'danger',
        active: false,
        class: 'bg-transparent text-[color:var(--acid-text-2)] border-[color:var(--acid-border-default)]',
      },
    ],
    defaultVariants: { tone: 'default', active: false },
  }
);

/** Padlock badge pinned to a gated control. */
export const ordLockBadge = cva(
  'absolute flex items-center justify-center rounded-full ' +
    'bg-[color:var(--acid-premium)] text-[color:var(--acid-on-accent)] ' +
    'border-2 border-[color:var(--acid-bg-base)]',
  {
    variants: {
      size: { sm: 'w-[19px] h-[19px]', md: 'w-[22px] h-[22px]' },
      position: { tile: 'top-2 right-2', card: 'top-1.5 right-1.5', float: '-top-1.5 -right-1.5' },
    },
    defaultVariants: { size: 'sm', position: 'tile' },
  }
);

/** Pill chip — languages, break modes, beds, ratios, animation choices. */
export const chip = cva(
  'inline-flex items-center gap-[5px] rounded-full border font-bold cursor-pointer transition-colors duration-[var(--dur-tap)]',
  {
    variants: {
      selected: {
        // Border + wash is the whole marker. Adding acid *text* on top made
        // one boolean shout three times, and a panel of a dozen chips is
        // where the accent stopped reading as "you chose this".
        true: 'border-[var(--ord-acid)] bg-[var(--ord-acid)]/15 text-[var(--ord-paper)]',
        false:
          'border-[var(--border-hairline)] bg-[var(--ord-paper)]/5 text-[var(--text-body)] hover:text-[var(--ord-paper)]',
      },
      size: {
        sm: 'h-7 px-[10px] ord-type-footnote',
        md: 'h-8 px-3 ord-type-footnote',
      },
    },
    defaultVariants: { selected: false, size: 'sm' },
  }
);

/** A word chip inside the expanded transcript row. */
export const wordChip = cva(
  'rounded-md px-1 py-1 ord-type-label cursor-text transition-colors duration-[var(--dur-tap)]',
  {
    variants: {
      state: {
        idle: 'bg-transparent text-[var(--text-body)]',
        accent: 'bg-transparent text-[var(--ord-cyan)]',
        active: 'bg-[var(--ord-acid)] text-[var(--ord-ink)]',
      },
    },
    defaultVariants: { state: 'idle' },
  }
);

export const acidPill = cva(
  'flex-1 text-center font-acid-body font-medium ' +
  'text-acid-label rounded-acid-md py-2.5 ' +
  'transition-colors duration-[var(--acid-duration-micro)] cursor-pointer select-none',
  {
    variants: {
      active: {
        true: 'bg-acid-accent-soft text-acid-accent shadow-[inset_0_0_0_1px_var(--acid-accent-ring)]',
        false: 'text-acid-text-2 hover:text-acid-text-1',
      },
    },
    defaultVariants: { active: false },
  }
);

export type ChipProps = VariantProps<typeof chip>;
