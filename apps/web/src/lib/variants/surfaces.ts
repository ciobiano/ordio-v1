/**
 * Panels, cards and canvas frames — the things content sits on.
 */

import { cva } from 'class-variance-authority';

/**
 * Panel/card container — glass surface used for editors and settings panels.
 */
export const panelCard = 'rounded-2xl bg-muted border border-border';

/** The recessed card a slider or toggle row sits in. */
export const ordFieldCard = 'flex flex-col gap-2 p-3 rounded-2xl bg-white/[0.05]';

/**
 * Canvas preview frame — the outer chrome around the rendered video canvas.
 * Aspect ratio varies per format, set via the --canvas-aspect-ratio custom
 * property rather than an inline style prop.
 */
export const canvasPreviewFrame =
  'relative rounded-xl overflow-hidden w-full bg-[#0a0a0a] border border-white/[0.12] ' +
  'shadow-[0_18px_48px_rgba(0,0,0,0.42)] animate-[fadeIn_0.2s_ease-out] ' +
  'aspect-[var(--canvas-aspect-ratio)] transition-[aspect-ratio] duration-300 ease-out';

/**
 * Optional composition grid overlay on the canvas preview. Cell size varies
 * per instance via the --grid-size custom property.
 */
export const canvasGridOverlay =
  'absolute inset-0 pointer-events-none mix-blend-overlay ' +
  'bg-[length:var(--grid-size)_var(--grid-size)] ' +
  '[background-image:linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)]';

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
  'flex w-full cursor-pointer items-start gap-3 rounded-[14px] px-3 py-2 text-left transition-colors duration-[var(--dur-tap)]',
  {
    variants: {
      selected: {
        /* Paper, like a selected timeline block. Lime inside the row is kept
           for the words you emphasised — the chosen values. */
        true: 'bg-[var(--ord-paper)]/6',
        false: 'bg-transparent hover:bg-[var(--ord-paper)]/5',
      },
    },
    defaultVariants: { selected: false },
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
  'absolute flex items-center overflow-hidden rounded-[10px] border cursor-pointer whitespace-nowrap transition-colors duration-[var(--dur-tap)]',
  {
    variants: {
      tone: {
        /* Caption blocks are paper-tinted, not hued. They are the words
           themselves, and the playhead is the one lime thing on the timeline,
           so the blocks stay quiet enough for it to read. */
        speech:
          'border-transparent bg-[var(--ord-paper)]/7 text-[var(--text-body)] hover:bg-[var(--ord-paper)]/10',
        music:
          'border-[var(--track-music)] bg-[var(--track-music-fill)] text-[var(--ord-paper)]/70',
      },
      state: {
        /* Under the playhead: brighten the words, nothing else. */
        idle: '',
        active: 'text-[var(--ord-paper)]',
        /* Selected: raised a step and ringed in paper. */
        selected:
          'border-[var(--ord-paper)]/40 bg-[var(--ord-paper)]/14 text-[var(--ord-paper)]',
      },
    },
    defaultVariants: { tone: 'speech', state: 'idle' },
  }
);
