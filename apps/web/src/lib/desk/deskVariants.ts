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
/**
 * Rail tool button.
 *
 * Selected is a lime tint plus lime foreground, not a lime fill — see the
 * marker rule in ord-editor.css for why. Hover is declared per selection
 * state on purpose: a single hover rule out-specified the selected rule once
 * before and painted near-white text on the lime fill at about 1.1:1.
 */
export const railButton = cva('ord-rail-btn transition-colors duration-[var(--dur-tap)]', {
  variants: {
    selected: {
      true: 'bg-[var(--ord-acid)]/14 text-[var(--ord-acid)] enabled:hover:bg-[var(--ord-acid)]/22',
      false:
        'bg-transparent text-[var(--text-muted)] enabled:hover:bg-[var(--ord-paper)]/8 enabled:hover:text-[var(--ord-paper)]',
    },
  },
  defaultVariants: { selected: false },
});

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

/** Square-ish icon button in the top bar and panel headers. */
export const iconButton = cva(
  'flex items-center justify-center rounded-[9px] cursor-pointer transition-colors duration-[var(--dur-tap)] disabled:cursor-default disabled:opacity-40',
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

/**
 * Solid commit buttons — the acid fill is the single export action.
 *
 * Brought in line with mobile's `ordStickerBtn`, whose own docstring names
 * Export as the case for the raised treatment. The desktop had a generic
 * `active:scale-[0.97]`, no focus ring at all, and no reduced-motion or
 * disabled guards — so a keyboard user got the browser default outline on a
 * lime fill, and a disabled button still animated under the pointer.
 *
 * `elevation` is declared BEFORE `tone` on purpose: CVA emits variant classes
 * in key order and tailwind-merge resolves a conflict in favour of the later
 * key, so anything a tone needs to override has to come after the elevation.
 * See memory/pitfall_cva_variant_key_order.
 */
export const solidButton = cva(
  'flex items-center justify-center gap-2 rounded-xl border-0 font-bold cursor-pointer ' +
    'transition-transform duration-[var(--dur-tap)] ease-[var(--ease-snap)] motion-reduce:transition-none ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)] ' +
    'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ord-ink)] ' +
    'disabled:opacity-40 disabled:cursor-not-allowed',
  {
    variants: {
      elevation: {
        /** Sitting on the page or the canvas — the top bar's Export. */
        raised:
          'border-[3px] border-[var(--ord-ink)] shadow-[var(--shadow-sticker)] ' +
          'active:translate-x-[3px] active:translate-y-[3px] active:shadow-none ' +
          'motion-reduce:active:translate-x-0 motion-reduce:active:translate-y-0 ' +
          'disabled:active:translate-x-0 disabled:active:translate-y-0',
        /**
         * Inside a sheet, drawer or panel. A sticker needs a surface to peel
         * off: the shadow is ink, which reads against the page and all but
         * vanishes against the sheet, leaving a 3px border that looks like a
         * gap and no peel to show for it. A sheet is already the raised layer.
         */
        flat: 'shadow-none active:scale-[0.97] motion-reduce:active:scale-100 disabled:active:scale-100',
      },
      tone: {
        acid: 'bg-[var(--ord-acid)] text-[var(--ord-ink)]',
        paper: 'bg-[var(--ord-paper)] text-[var(--ord-ink)]',
      },
      size: {
        sm: 'h-[30px] px-3 ord-type-footnote',
        md: 'h-[38px] px-4 ord-type-label',
        lg: 'h-11 px-4 ord-type-label',
      },
    },
    defaultVariants: { elevation: 'flat', tone: 'acid', size: 'md' },
  }
);

/** Transcript row, media clip row — a selectable list item. */
/**
 * A transcript row.
 *
 * No left border. A 3px lime rail down the side of every selected row put the
 * accent on position — the one job DESIGN.md reserves it from — and it read as
 * heavy beside rows that are mostly text. The tint alone marks selection, and
 * the row that is playing is already marked by its highlighted word.
 */
export const listRow = cva(
  'flex w-full cursor-pointer items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-[var(--dur-tap)]',
  {
    variants: {
      selected: {
        true: 'bg-[var(--ord-acid)]/12',
        false: 'bg-transparent hover:bg-[var(--ord-paper)]/5',
      },
    },
    defaultVariants: { selected: false },
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

/**
 * Timeline blocks.
 *
 * `tone` is declared before `state` on purpose: tailwind-merge resolves a
 * conflict in favour of the later-declared variant, so a selected block's lime
 * border and fill beat its track hue. Swapping the two keys silently inverts
 * that — see memory/pitfall_cva_variant_key_order.
 */
export const trackBlock = cva(
  'absolute flex items-center overflow-hidden rounded-xl border cursor-pointer whitespace-nowrap transition-colors duration-[var(--dur-tap)]',
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
