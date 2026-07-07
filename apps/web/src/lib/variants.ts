import { cva } from 'class-variance-authority';

/**
 * Large primary pill button — white fill, main CTAs (Export, Download).
 */
export const primaryBtn =
  'w-full sm:w-auto px-10 py-3.5 bg-primary text-primary-foreground rounded-full ' +
  'text-sm font-[600] tracking-[-0.01em] ' +
  'hover:bg-white/92 transition-all duration-200 ' +
  'hover:scale-[1.02] active:scale-[0.98] cursor-pointer ' +
  'shadow-[0_8px_32px_rgba(255,255,255,0.08)]';

/**
 * Ghost text button — muted label that brightens on hover.
 * Minimal 2px padding; slim inline shape.
 */
export const ghostBtn =
  'text-muted-foreground text-xs hover:text-white/85 transition-colors duration-150 ' +
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
  'cursor-pointer transition-all duration-150 select-none text-xs min-h-11',
  {
    variants: {
      shape: {
        pill:     'rounded-full px-3 py-1.5 border',
        rect:     'rounded-md px-5 py-2 text-sm',
        bordered: 'rounded-lg px-3 py-1.5 border',
      },
      active: {
        true:  '',
        false: 'text-muted-foreground hover:text-white/80',
      },
      tone: {
        white:  '',
        subtle: '',
      },
    },
    compoundVariants: [
      // Inactive states vary by shape
      { active: false, shape: 'pill',     class: 'bg-muted border-border' },
      { active: false, shape: 'rect',     class: 'hover:bg-muted' },
      { active: false, shape: 'bordered', class: 'bg-muted border-border hover:bg-muted' },
      // Active states vary by tone
      { active: true, tone: 'white',  class: 'bg-primary text-primary-foreground' },
      { active: true, tone: 'subtle', class: 'bg-accent border-border text-foreground' },
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
        idle:     'w-16 h-16 bg-muted text-foreground hover:bg-muted',
        pause:    'w-12 h-12 bg-white/8 text-white/60 hover:bg-white/12',
        settings: 'w-12 h-12 bg-white/8 text-white/60 hover:bg-white/12',
        stop:     'w-20 h-20 bg-destructive/15 border-2 border-destructive/60 text-destructive hover:bg-destructive/25',
        play:     'w-16 h-16 shrink-0 bg-primary text-primary-foreground border border-primary hover:bg-white/90',
        nav:      'w-10 h-10 bg-muted text-muted-foreground hover:bg-muted hover:text-foreground',
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
  'w-full rounded-2xl font-bold tracking-tight transition-all duration-150 bg-white text-black active:scale-[0.98]',
  {
    variants: {
      size: {
        default: 'h-14 text-sm',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
);

/**
 * Unified Capture screen — dock/header primitives for the idle → recording → paused →
 * ready → processing morphing shell. Matches the Claude Design "Unified Capture" mockup's
 * black/white iOS aesthetic directly (kept distinct from the acid system below — this
 * screen's visual language comes from the commissioned design, not the acid palette).
 */
export const captureNavBtn =
  'w-10 h-10 rounded-full flex items-center justify-center border-none bg-white/8 text-white ' +
  'cursor-pointer transition-all duration-300 hover:bg-white/12';

export const capturePillBar =
  'flex-1 min-w-0 flex items-center gap-2.5 h-15 px-5 rounded-full bg-white/94 border-none ' +
  'cursor-pointer text-black/40 text-base';

export const captureRecordBtn =
  'shrink-0 w-15 h-15 rounded-full flex items-center justify-center bg-[#1c1c1e] border-none cursor-pointer';

/**
 * Center dock slot — waveform (recording/paused), "Process recording" pill (ready), or
 * progress bar (processing). Size/radius are discrete per phase so CVA covers them; the
 * progress bar's fill width is a continuously animated value set via inline style instead.
 */
export const captureCenterSlot = cva(
  'flex-1 min-w-0 relative flex items-center justify-center overflow-hidden border-none transition-all duration-300',
  {
    variants: {
      phase: {
        recordPaused: 'h-15 bg-white rounded-full px-5 cursor-default',
        ready: 'h-15 bg-white rounded-full cursor-pointer',
        processing: 'h-3 bg-white/10 rounded-full cursor-default',
      },
    },
  }
);

/**
 * Round dock button — settings/stop/pause/play/restart/cancel. Distinct tones per role:
 * neutral (settings, cancel), dark (stop-to-ready), danger (pause/play/restart — the
 * mockup gives the mid button a destructive-red tint regardless of which icon it shows).
 */
export const captureRoundBtn = cva(
  'shrink-0 w-14 h-14 rounded-full flex items-center justify-center border-none cursor-pointer transition-colors duration-200',
  {
    variants: {
      tone: {
        neutral: 'bg-white/9 text-white hover:bg-white/14',
        dark: 'bg-[#1c1c1e] text-white',
        danger: 'bg-[rgba(255,69,58,0.16)] border border-[rgba(255,69,58,0.5)] text-white',
      },
    },
    defaultVariants: { tone: 'neutral' },
  }
);

/**
 * Panel/card container — glass surface used for editors and settings panels.
 */
export const panelCard = 'rounded-2xl bg-muted border border-border';

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
  'font-mono text-xs tracking-[0.15em] uppercase text-white/40';

/**
 * Body text — responsive sizes matching design tokens.
 */
export const body = cva('leading-[var(--leading-body)]', {
  variants: {
    size: {
      xl: 'text-xl',
      lg: 'text-lg',
      default: 'text-sm',
      sm: 'text-sm',
      caption: 'text-xs leading-[var(--leading-caption)]',
      footnote: 'text-xs leading-[var(--leading-caption)]',
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
      default: 'border-border border-2',
      subtle: 'border-border border-2',
      accent: 'border-l-4 border-l-accent-green',
    },
  },
  defaultVariants: { variant: 'default' },
});

/* ─────────────────────────────────────────────────────────────
 * Acid design system — bold consumer/expressive (see DESIGN.md).
 * New surfaces use these; existing components migrate over time.
 * ───────────────────────────────────────────────────────────── */

/**
 * Acid heading — Clash Grotesk display scale. Expressive hero type.
 */
export const acidHeading = cva('font-acid-display font-semibold', {
  variants: {
    level: {
      display: 'text-[length:var(--acid-text-display)] leading-[0.98] tracking-[-0.03em]',
      title: 'text-[length:var(--acid-text-title)] leading-[1.02] tracking-[-0.02em]',
      headline: 'text-[length:var(--acid-text-headline)] leading-[1.15] tracking-[-0.01em]',
    },
  },
  defaultVariants: { level: 'title' },
});

/**
 * Acid body — Satoshi. Friendly, readable, used for descriptions/controls.
 */
export const acidBody = cva('font-acid-body leading-[1.5]', {
  variants: {
    size: {
      lg: 'text-[length:var(--acid-text-body)] font-medium',
      default: 'text-[length:var(--acid-text-body)]',
      caption: 'text-[length:var(--acid-text-caption)]',
      footnote: 'text-[length:var(--acid-text-footnote)] tabular-nums',
    },
  },
  defaultVariants: { size: 'default' },
});

/**
 * Acid eyebrow — punchy uppercase label, replaces the old monospace eyebrow.
 */
export const acidEyebrow =
  'font-acid-body font-black text-[length:var(--acid-text-label)] ' +
  'tracking-[0.14em] uppercase text-acid-text-3';

/**
 * Acid surface — elevation-ladder card/panel container.
 */
export const acidSurface = cva('border border-acid-border-default', {
  variants: {
    level: {
      1: 'bg-acid-surface-1',
      2: 'bg-acid-surface-2',
      3: 'bg-acid-surface-3',
    },
    radius: {
      md: 'rounded-acid-md',
      lg: 'rounded-acid-lg',
      xl: 'rounded-acid-xl',
    },
  },
  defaultVariants: { level: 1, radius: 'lg' },
});

/**
 * Acid primary CTA — lime fill, ink text. The confident, signature button.
 */
export const acidCta = cva(
  'inline-flex items-center justify-center font-acid-body font-bold ' +
  'bg-acid-accent text-acid-on-accent rounded-acid-full ' +
  'transition-transform duration-[var(--acid-duration-micro)] ' +
  'active:scale-95 cursor-pointer',
  {
    variants: {
      size: {
        default: 'h-14 px-8 text-[length:var(--acid-text-body)]',
        sm: 'h-11 px-5 text-[length:var(--acid-text-label)]',
      },
    },
    defaultVariants: { size: 'default' },
  }
);

/**
 * Acid pill — selectable tab/option (e.g. control dock: Captions/Style/Trim/Reframe).
 */
export const acidPill = cva(
  'flex-1 text-center font-acid-body font-medium ' +
  'text-[length:var(--acid-text-label)] rounded-acid-md py-2.5 ' +
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

/**
 * Share card — the hero export artifact ("Wrapped for your voice"). 9:16,
 * chunky radius, bold color variants. Independent of the main app's accent —
 * this is where colorful, varied theming lives per DESIGN.md.
 *
 *   variant: 'sunset'   → coral → pink, warm/friendly
 *            'acid'     → ink + electric lime, young/loud
 *            'electric' → cobalt → cyan, cool/modern
 */
export const shareCard = cva('relative aspect-9/16 rounded-acid-xl overflow-hidden', {
  variants: {
    variant: {
      sunset: 'bg-[linear-gradient(155deg,#FF8A4A_0%,#FF2E7E_55%,#B0165C_100%)] text-white',
      acid: 'bg-acid-bg-base text-acid-text-1',
      electric: 'bg-[linear-gradient(155deg,#3A2BFF_0%,#4D7CFF_45%,#00D4FF_100%)] text-white',
    },
  },
  defaultVariants: { variant: 'acid' },
});

/**
 * Share card headline — the one emphasized line per card, gradient text.
 * Reserved usage: never a background wash, only this single line.
 */
export const shareCardHeadline = cva('font-acid-display font-semibold', {
  variants: {
    variant: {
      sunset: 'text-[#FFF0D6]',
      acid: 'text-acid-signal',
      electric: 'text-[#CFF6FF]',
    },
  },
  defaultVariants: { variant: 'acid' },
});
