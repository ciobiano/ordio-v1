/**
 * Long-form reading column — the /writing routes.
 */

import { cva } from 'class-variance-authority';

/* ─────────────────────────────────────────────────────────────
 * Long-form prose — the /writing routes.
 *
 * Deliberately not `acidBody`. The acid scale is UI type: labels, control
 * descriptions, and Wrapped-style numerals, all read in glances. An article
 * is read for ten minutes straight, which wants a narrower measure, looser
 * leading, and rhythm between blocks rather than punch inside them.
 *
 * Per DESIGN.md, lime stays off this page except on the one action that
 * leaves it. Body copy is never accent-coloured.
 * ───────────────────────────────────────────────────────────── */

/**
 * Article column.
 *
 * `measure` sets the line length, which is the single decision that most
 * affects whether long text is comfortable. Characters per line, not pixels,
 * because the comfortable range is a property of the type, not the viewport.
 */
export const proseColumn = cva('mx-auto w-full px-5 sm:px-6', {
  variants: {
    measure: {
      /** Roomier: fewer line breaks, more words in view at once. */
      wide: 'max-w-[75ch]',
      /** Classic reading measure. */
      default: 'max-w-[68ch]',
      /** Tighter: easier eye return, more scrolling. */
      narrow: 'max-w-[62ch]',
    },
  },
  defaultVariants: { measure: 'default' },
});

/**
 * Prose block spacing — the vertical rhythm between elements.
 *
 * Space above a heading is larger than space below it, so a heading binds to
 * the text it introduces rather than floating between two sections.
 */
export const proseBlock = cva('', {
  variants: {
    kind: {
      paragraph: 'mt-5 first:mt-0',
      heading: 'mt-12 mb-4 first:mt-0',
      figure: 'my-8',
      code: 'my-6',
      lede: 'mt-4 mb-10',
    },
  },
  defaultVariants: { kind: 'paragraph' },
});

/**
 * Prose body copy. Larger than UI body text: 15px is right for a control
 * label and too small for a paragraph someone reads for ten minutes.
 */
export const proseText = cva('font-acid-body text-acid-text-2', {
  variants: {
    size: {
      lede: 'text-[length:var(--text-body-xl)] leading-[1.6] text-acid-text-1',
      default: 'text-[length:var(--text-body-lg)] leading-[1.7]',
      caption: 'text-[length:var(--text-caption)] leading-[1.5] text-acid-text-3',
    },
  },
  defaultVariants: { size: 'default' },
});

/**
 * Code and terminal output inside an article.
 *
 * Two different things share this shape, and they diverge on what happens when
 * the block is wider than the screen. On a 375px phone the results table runs
 * to about 55 monospace characters and does not fit.
 *
 * `source` wraps. A wrapped line of TypeScript is ugly and still readable, and
 * wrapping costs the reader no gesture and no lost content.
 *
 * `output` scrolls. Its columns are the content: wrap the results table and
 * the numbers stop lining up under their headings, which is the whole reason
 * it is a table. Shrinking the type was the other candidate and was rejected
 * for making the smallest screen carry the smallest text.
 *
 * A scrollable region has to be reachable without a pointer, so the `output`
 * element also takes `tabIndex={0}` at the call site. That is a WCAG 2.1.1
 * requirement rather than a nicety: a keyboard user with no way to focus the
 * region cannot scroll it, and the right-hand columns simply do not exist for
 * them.
 */
export const proseCode = cva(
  'rounded-lg border border-acid-border-default bg-acid-bg-subtle p-4 font-mono text-acid-text-2',
  {
    variants: {
      kind: {
        /** Source code. A broken line is survivable; a hidden one is not. */
        source: 'text-[length:var(--text-caption)] leading-[1.6] whitespace-pre-wrap break-words',
        /** Fixed-width results. Column alignment carries the meaning. */
        output:
          'text-[length:var(--text-caption)] leading-[1.6] overflow-x-auto ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acid-accent',
      },
    },
    defaultVariants: { kind: 'source' },
  }
);

/**
 * Article headings.
 *
 * Not `acidHeading`, for two reasons found by rendering the page rather than
 * by type-checking it.
 *
 * Sizes use the `text-[length:...]` form rather than the `text-acid-*` theme
 * utilities. Stock tailwind-merge cannot tell `text-acid-title` (a size) from
 * `text-acid-text-1` (a colour) — both are `text-*` keys it has no rule for —
 * so passing the two through `cn()` drops one silently. The explicit `length:`
 * hint puts the class in the font-size group and lets size and colour coexist.
 *
 * No `font-*` class, because it would be dead code: globals.css sets `h1..h6`
 * to `--font-heading` as unlayered CSS, and unlayered rules beat `@layer
 * utilities` regardless of specificity. Headings here are monospace by
 * inheritance, which suits a technical article. Changing that means changing
 * the global rule, not adding a class.
 */
export const proseHeading = cva('text-acid-text-1', {
  variants: {
    level: {
      title: 'text-[length:var(--text-h1)] leading-[var(--leading-display)] tracking-[-1px]',
      section: 'text-[length:var(--text-h3)] leading-[var(--leading-heading)]',
    },
  },
  defaultVariants: { level: 'section' },
});
