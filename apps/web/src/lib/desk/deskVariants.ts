/**
 * CVA variants for the desktop editor.
 *
 * The design expresses selection as inline colour swaps (`SEL_BG` /`IDLE_BG`
 * computed in its runtime). Here selection is a variant, and the colours come
 * from the [data-ord] token layer, so a palette change never means touching a
 * component.
 */

import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Rail tool button — the six-item column on the far right.
 *
 * Hover is defined per selection state, not once for the button. A single
 * `hover:text-paper` rule looks harmless but lands on the selected button too,
 * putting near-white text on the lime fill: #f4f5ef on #c6ff3d is about 1.15:1,
 * so the label all but vanishes on the one control that is currently active.
 * The selected button keeps ink and dims the fill instead; the unselected ones
 * get a real background lift rather than a 42% → 100% text nudge that reads as
 * nothing on a dark rail. `enabled:` keeps both off the disabled state.
 */
export const railButton = cva('ord-rail-btn transition-colors', {
  variants: {
    selected: {
      true: 'bg-[var(--ord-acid)] text-[var(--ord-ink)] enabled:hover:brightness-90',
      false:
        'bg-transparent text-[var(--text-muted)] enabled:hover:bg-[var(--ord-paper)]/8 enabled:hover:text-[var(--ord-paper)]',
    },
  },
  defaultVariants: { selected: false },
});

/** Pill chip — languages, break modes, beds, ratios, animation choices. */
export const chip = cva(
  'inline-flex items-center gap-[5px] rounded-full border font-bold cursor-pointer transition-colors',
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

/** Square-ish icon button in the top bar and panel headers. */
export const iconButton = cva(
  'flex items-center justify-center rounded-[9px] cursor-pointer transition-colors disabled:cursor-default disabled:opacity-40',
  {
    variants: {
      tone: {
        outline:
          'border border-[var(--border-hairline)] bg-transparent text-[var(--text-body)] hover:text-[var(--ord-paper)]',
        bare: 'border-0 bg-transparent text-[var(--text-body)] hover:text-[var(--ord-paper)]',
        active:
          'border border-[var(--ord-acid)] bg-[var(--ord-acid)]/15 text-[var(--ord-paper)]',
      },
      size: {
        sm: 'size-[30px]',
        md: 'size-[34px]',
      },
    },
    defaultVariants: { tone: 'outline', size: 'md' },
  }
);

/** Solid commit buttons. The acid fill is the single export action. */
export const solidButton = cva(
  'flex items-center justify-center gap-2 rounded-[11px] border-0 font-bold cursor-pointer transition-transform active:scale-[0.97]',
  {
    variants: {
      tone: {
        acid: 'bg-[var(--ord-acid)] text-[var(--ord-ink)]',
        paper: 'bg-[var(--ord-paper)] text-[var(--ord-ink)]',
      },
      size: {
        sm: 'h-[30px] px-3 ord-type-footnote',
        md: 'h-[38px] px-5 ord-type-label',
        lg: 'h-11 px-6 ord-type-label',
      },
    },
    defaultVariants: { tone: 'acid', size: 'md' },
  }
);

/** Transcript row, media clip row — a selectable list item. */
export const listRow = cva(
  'flex w-full cursor-pointer items-start gap-[10px] rounded-[10px] px-[11px] py-[9px] text-left transition-colors',
  {
    variants: {
      selected: {
        true: 'bg-[var(--ord-acid)]/12 border-l-[3px] border-l-[var(--ord-acid)]',
        false:
          'bg-transparent border-l-[3px] border-l-transparent hover:bg-[var(--ord-paper)]/5',
      },
    },
    defaultVariants: { selected: false },
  }
);

/** A word chip inside the expanded transcript row. */
export const wordChip = cva(
  'rounded-[5px] px-1 py-0.5 ord-type-label cursor-text transition-colors',
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

/**
 * Timeline blocks.
 *
 * `tone` is declared before `state` on purpose: tailwind-merge resolves a
 * conflict in favour of the later-declared variant, so a selected block's lime
 * border and fill beat its track hue. Swapping the two keys silently inverts
 * that — see memory/pitfall_cva_variant_key_order.
 */
export const trackBlock = cva(
  'absolute flex items-center overflow-hidden rounded-lg border cursor-pointer whitespace-nowrap transition-colors',
  {
    variants: {
      tone: {
        speech:
          'border-[var(--track-speech)] bg-[var(--track-speech-fill)] text-[var(--ord-paper)]/70',
        music:
          'border-[var(--track-music)] bg-[var(--track-music-fill)] text-[var(--ord-paper)]/70',
      },
      state: {
        /* Under the playhead: brighten the words, nothing else. The playhead
           already marks position, so a second position signal would be the
           timeline saying the same thing twice in two colours. */
        idle: '',
        active: 'text-[var(--ord-paper)]',
        /* Selected is a chosen value, which is the one thing lime is for. */
        selected: 'border-[var(--ord-acid)] bg-[var(--ord-acid)]/20 text-[var(--ord-paper)]',
      },
    },
    defaultVariants: { tone: 'speech', state: 'idle' },
  }
);

export type RailButtonProps = VariantProps<typeof railButton>;
export type ChipProps = VariantProps<typeof chip>;
export type IconButtonProps = VariantProps<typeof iconButton>;
export type SolidButtonProps = VariantProps<typeof solidButton>;
