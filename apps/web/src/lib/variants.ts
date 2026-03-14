import { cva } from 'class-variance-authority';

/**
 * Large primary pill button — white fill, main CTAs (Export, Download).
 */
export const primaryBtn =
  'w-full sm:w-auto px-10 py-3.5 bg-white text-black rounded-full ' +
  'text-[0.9375rem] font-[600] tracking-[-0.01em] ' +
  'hover:bg-white/92 transition-all duration-200 ' +
  'hover:scale-[1.02] active:scale-[0.98] cursor-pointer ' +
  'shadow-[0_8px_32px_rgba(255,255,255,0.08)]';

/**
 * Ghost text button — muted label that brightens on hover.
 * Minimal 2px padding; slim inline shape.
 */
export const ghostBtn =
  'text-white/60 text-[0.8125rem] hover:text-white/85 transition-colors duration-150 ' +
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
 *   tone:   'blue'   → blue fill when active  (caption)
 *           'white'  → white fill when active (format)
 *           'subtle' → soft white fill when active (font, others)
 */
export const optionBtn = cva(
  'cursor-pointer transition-all duration-150 select-none text-xs min-h-[36px]',
  {
    variants: {
      shape: {
        pill:     'rounded-full px-3 py-1.5 border',
        rect:     'rounded-md px-5 py-2 text-sm',
        bordered: 'rounded-lg px-3 py-1.5 border',
      },
      active: {
        true:  '',
        false: 'text-white/60 hover:text-white/80',
      },
      tone: {
        blue:   '',
        white:  '',
        subtle: '',
      },
    },
    compoundVariants: [
      // Inactive states vary by shape
      { active: false, shape: 'pill',     class: 'bg-white/10 border-white/10' },
      { active: false, shape: 'rect',     class: 'hover:bg-white/5' },
      { active: false, shape: 'bordered', class: 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08]' },
      // Active states vary by tone
      { active: true, tone: 'blue',   class: 'bg-blue-500 border-blue-500/60 text-white' },
      { active: true, tone: 'white',  class: 'bg-white text-black' },
      { active: true, tone: 'subtle', class: 'bg-white/15 border-white/30 text-white' },
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
 */
export const roundIconBtn = cva(
  'flex items-center justify-center rounded-full transition-all duration-150',
  {
    variants: {
      intent: {
        idle:     'w-16 h-16 bg-[--surface] text-[--primary] hover:bg-[--surface-hover]',
        pause:    'w-12 h-12 bg-[--surface] text-[--primary] hover:bg-[--surface-hover]',
        settings: 'w-12 h-12 bg-[--surface] text-[--primary] hover:bg-[--surface-hover]',
        stop:     'w-16 h-16 bg-[rgba(225,29,72,0.15)] border-2 border-[rgba(225,29,72,0.6)] text-destructive hover:bg-[rgba(225,29,72,0.25)]',
        play:     'w-11 h-11 shrink-0 bg-white text-black border border-white hover:bg-white/90',
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
  'w-full rounded-xl font-semibold tracking-tight transition-all duration-150 bg-[#FAF8F5] text-black',
  {
    variants: {
      size: {
        default: 'py-3.5 text-sm',
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
export const panelCard = 'rounded-2xl bg-white/[0.03] border border-white/[0.06]';
