import { cva } from 'class-variance-authority';

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
    'font-semibold text-[13px] ' +
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

/* ------------------------------------------------------------------ *
 * Sticker button — the design's signature press.
 * ------------------------------------------------------------------ */

export const ordStickerBtn = cva(
  'inline-flex items-center justify-center gap-2 cursor-pointer font-semibold ' +
    'border-[3px] border-[color:var(--acid-bg-base)] shadow-[var(--acid-shadow-sticker-sm)] ' +
    'transition-transform duration-[var(--acid-dur-tap)] ease-[var(--acid-ease-snap)] ' +
    'active:translate-x-[3px] active:translate-y-[3px] active:shadow-none ' +
    'motion-reduce:transition-none motion-reduce:active:translate-x-0 motion-reduce:active:translate-y-0 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--acid-accent-ring)] ' +
    'disabled:opacity-40 disabled:cursor-not-allowed ' +
    'disabled:active:translate-x-0 disabled:active:translate-y-0',
  {
    variants: {
      tone: {
        accent: 'bg-[color:var(--acid-accent)] text-[color:var(--acid-on-accent)]',
        premium: 'bg-[color:var(--acid-premium)] text-[color:var(--acid-on-accent)]',
        paper: 'bg-[color:var(--acid-text-1)] text-[color:var(--acid-on-accent)]',
      },
      shape: { pill: 'rounded-full', square: 'rounded-2xl', round: 'rounded-full' },
      size: {
        sm: 'h-11 px-4 text-sm',
        md: 'h-[46px] px-5 text-[17px]',
        lg: 'h-12 px-6 text-[15px]',
        icon: 'w-12 h-12 p-0',
      },
    },
    defaultVariants: { tone: 'accent', shape: 'pill', size: 'md' },
  }
);

/** Quiet counterpart — Cancel, Reset, Not now, Done. */
export const ordGhostBtn = cva(
  'inline-flex items-center justify-center cursor-pointer font-semibold rounded-full ' +
    'border-2 border-[color:var(--acid-border-default)] bg-transparent ' +
    'text-[color:var(--acid-text-2)] transition-colors duration-[var(--acid-dur-tap)] ' +
    'hover:text-[color:var(--acid-text-1)] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--acid-accent-ring)] ' +
    'disabled:opacity-40 disabled:cursor-not-allowed',
  {
    variants: {
      size: { sm: 'h-[38px] px-4 text-xs', md: 'h-11 px-4 text-sm', lg: 'h-12 px-4 text-[15px]' },
    },
    defaultVariants: { size: 'md' },
  }
);

/* ------------------------------------------------------------------ *
 * Static class strings — repeated enough to name.
 * ------------------------------------------------------------------ */

/** UPPERCASE structural label. Uses the ACID eyebrow tracking. */
export const ordSectionLabel =
  'text-[length:var(--acid-text-footnote)] font-semibold uppercase ' +
  'tracking-[var(--acid-tracking-eyebrow)] text-[color:var(--acid-text-3)]';

/** The recessed card a slider or toggle row sits in. */
export const ordFieldCard = 'flex flex-col gap-2 p-3 rounded-2xl bg-white/[0.05]';

/** Row label — sentence case, the thing a control is named by. */
export const ordFieldLabel = 'text-[13px] font-semibold text-[color:var(--acid-text-2)]';

/** Secondary line under a field label. */
export const ordFieldHint =
  'text-[11px] leading-tight text-[color:var(--acid-text-3)]';

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
