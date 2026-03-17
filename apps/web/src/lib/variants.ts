import { cva } from 'class-variance-authority';

/**
 * Large primary pill button — white fill, main CTAs (Export, Download).
 */
export const primaryBtn =
  'w-full sm:w-auto px-10 py-3.5 bg-[--primary] text-black rounded-full ' +
  'text-[length:var(--text-body)] font-[600] tracking-[-0.01em] ' +
  'hover:bg-white/92 transition-all duration-200 ' +
  'hover:scale-[1.02] active:scale-[0.98] cursor-pointer ' +
  'shadow-[0_8px_32px_rgba(255,255,255,0.08)]';

/**
 * Ghost text button — muted label that brightens on hover.
 * Minimal 2px padding; slim inline shape.
 */
export const ghostBtn =
  'text-[--secondary] text-[length:var(--text-caption)] hover:text-white/85 transition-colors duration-150 ' +
  'cursor-pointer py-px px-1 rounded';

/**
 * Option/toggle button — single source of truth for all selectable option buttons.
 * Used in every radio group: caption style, video format, font selector.
 *
 *   shape:  'pill'     → rounded-full (caption selector)
 *           'rect'     → rounded-md, no border (format toggle)
 *           'bordered' → rounded-lg, bordered (font selector)
 *
 *   active: true  → selected state
 *           false → unselected state
 *
 *   tone:   'white'  → white fill when active (format, primary)
 *           'subtle' → soft white fill when active (font, others)
 */
export const optionBtn = cva(
  'cursor-pointer transition-all duration-150 select-none text-[length:var(--text-footnote)] min-h-11',
  {
    variants: {
      shape: {
        pill:     'rounded-full px-3 py-1.5 border',
        rect:     'rounded-md px-5 py-2 text-[length:var(--text-body-sm)]',
        bordered: 'rounded-lg px-3 py-1.5 border',
      },
      active: {
        true:  '',
        false: 'text-[--secondary] hover:text-white/80',
      },
      tone: {
        white:  '',
        subtle: '',
      },
    },
    compoundVariants: [
      // Inactive states vary by shape
      { active: false, shape: 'pill',     class: 'bg-[--surface-hover] border-[--border]' },
      { active: false, shape: 'rect',     class: 'hover:bg-[--surface]' },
      { active: false, shape: 'bordered', class: 'bg-[--surface] border-[--border] hover:bg-[--surface-hover]' },
      // Active states vary by tone
      { active: true, tone: 'white',  class: 'bg-[--primary] text-black' },
      { active: true, tone: 'subtle', class: 'bg-[--surface-active] border-[--border-active] text-[--primary]' },
    ],
    defaultVariants: { shape: 'bordered', active: false, tone: 'subtle' },
  }
);

/**
 * Circular icon button — single source of truth for all icon-only circular buttons.
 *
 *   intent: 'idle'     → mic orb (64px, surface bg)
 *           'pause'    → pause recording (48px, surface bg)
 *           'settings' → gear button (48px, surface bg)
 *           'stop'     → stop recording (64px, rose destructive ring)
 *           'play'     → playback play (small, white fill)
 *           'nav'      → small navigation button (40px, surface bg)
 */
export const roundIconBtn = cva(
  'flex items-center justify-center rounded-full transition-all duration-150',
  {
    variants: {
      intent: {
        idle:     'w-16 h-16 bg-[--surface] text-[--primary] hover:bg-[--surface-hover]',
        pause:    'w-16 h-16 bg-[--surface] text-[--primary] hover:bg-[--surface-hover]',
        settings: 'w-16 h-16 bg-[--surface] text-[--primary] hover:bg-[--surface-hover]',
        stop:     'w-16 h-16 bg-destructive/15 border-2 border-destructive/60 text-destructive hover:bg-destructive/25',
        play:     'w-16 h-16 shrink-0 bg-[--primary] text-black border border-[--primary] hover:bg-white/90',
        nav:      'w-10 h-10 bg-[--surface] text-[--secondary] hover:bg-[--surface-hover] hover:text-[--primary]',
      },
    },
    defaultVariants: { intent: 'idle' },
  }
);

/**
 * Proceed / CTA button — full-width warm-white pill used after stopping a recording.
 * Colors are baked into CVA base (never inline styles per project rule).
 */
export const proceedBtn = cva(
  'w-full rounded-xl font-semibold tracking-tight transition-all duration-150 bg-[--primary] text-black',
  {
    variants: {
      size: {
        default: 'py-3.5 text-[length:var(--text-body-sm)]',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
);

/**
 * Panel/card container — glass surface used for editors and settings panels.
 */
export const panelCard = 'rounded-2xl bg-[--surface] border border-[--border]';

/**
 * Brand heading — responsive type scale per GitHub 2026.
 * Uses CSS custom properties defined in globals.css.
 */
export const heading = cva('font-normal tracking-tight', {
  variants: {
    level: {
      display: 'text-[length:var(--text-display)] leading-[var(--leading-display)] tracking-[-1.5px]',
      h1: 'text-[length:var(--text-h1)] leading-[var(--leading-display)] tracking-[-1px]',
      h2: 'text-[length:var(--text-h2)] leading-[var(--leading-heading)] tracking-[-0.5px]',
      h3: 'text-[length:var(--text-h3)] leading-[var(--leading-heading)]',
      h4: 'text-[length:var(--text-h4)] leading-[var(--leading-heading)]',
      h5: 'text-[length:var(--text-h5)] leading-[var(--leading-heading)]',
      h6: 'text-[length:var(--text-h6)] leading-[var(--leading-heading)]',
    },
  },
  defaultVariants: { level: 'h2' },
});

/**
 * Eyebrow — monospace uppercase micro-label (GitHub 2026 pattern).
 */
export const eyebrow =
  'font-mono text-[length:var(--text-footnote)] tracking-[0.15em] uppercase text-white/40';

/**
 * Body text — responsive sizes matching design tokens.
 */
export const body = cva('leading-[var(--leading-body)]', {
  variants: {
    size: {
      xl: 'text-[length:var(--text-body-xl)]',
      lg: 'text-[length:var(--text-body-lg)]',
      default: 'text-[length:var(--text-body)]',
      sm: 'text-[length:var(--text-body-sm)]',
      caption: 'text-[length:var(--text-caption)] leading-[var(--leading-caption)]',
      footnote: 'text-[length:var(--text-footnote)] leading-[var(--leading-caption)]',
    },
  },
  defaultVariants: { size: 'default' },
});

/**
 * Brand border — accent strokes per brand guidelines.
 */
export const brandBorder = cva('', {
  variants: {
    variant: {
      default: 'border-[--border-active] border-2',
      subtle: 'border-[--border] border-2',
      accent: 'border-l-4 border-l-accent-green',
    },
  },
  defaultVariants: { variant: 'default' },
});
