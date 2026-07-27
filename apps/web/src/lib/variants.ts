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
 * Unified Capture screen — dock/header primitives for the idle → recording → paused →
 * ready → processing morphing shell. Matches the Claude Design "Unified Capture" mockup's
 * black/white iOS aesthetic directly (kept distinct from the acid system below — this
 * screen's visual language comes from the commissioned design, not the acid palette).
 */
/**
 * Glossy dark sphere — the shared look for every round icon button in this feature (header
 * nav, sidebar search/gear, dock settings/stop/cancel). `.capture-glossy-btn` (globals.css)
 * carries the radial-gradient + inset-shadow combo, since that's unwieldy as a utility string.
 */
export const captureGlossyBtn =
  'capture-glossy-btn shrink-0 rounded-full flex items-center justify-center ' +
  'text-white cursor-pointer transition-transform duration-300';

export const captureNavBtn = `${captureGlossyBtn} w-9 h-9`;

/**
 * Idle-dock hero record button — the primary action, sized and colored like a
 * camera/voice-memo shutter so it can't be mistaken for an input field.
 */
export const captureRecordHero =
  'shrink-0 w-17 h-17 rounded-full flex items-center justify-center bg-acid-error text-white ' +
  'border-4 border-white/15 cursor-pointer transition-transform duration-150 active:scale-92';

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
        recordPaused: 'h-11.5 bg-white rounded-full px-4.5 cursor-default',
        ready: 'h-11.5 bg-white rounded-full cursor-pointer',
        processing: 'h-2.5 bg-white/10 rounded-full cursor-default',
      },
    },
  }
);

/**
 * Round dock button — settings/stop/pause/play/restart/cancel, 40px (down from the mockup's
 * earlier 54-64px pass). Tone maps to what the action *means*, using the acid semantic
 * tokens instead of one undifferentiated red: `primary` (lime) for the confident "stop and
 * review" action, `warning` (amber) for pause, `success` (green) for resume, `danger` (red)
 * for restart since it discards the current take.
 */
export const captureRoundBtn = cva('shrink-0 w-10 h-10 rounded-full flex items-center justify-center', {
  variants: {
    tone: {
      neutral: `${captureGlossyBtn}`,
      primary: 'border-none cursor-pointer text-acid-on-accent bg-acid-accent',
      warning:
        'border-none cursor-pointer text-acid-warning bg-acid-warning/16 border border-acid-warning/50',
      success:
        'border-none cursor-pointer text-acid-success bg-acid-success/16 border border-acid-success/50',
      danger:
        'border-none cursor-pointer text-acid-error bg-acid-error/16 border border-acid-error/50',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

/**
 * Shared silhouette for all bottom sheets/drawers — solid dark bg, floating
 * inset, large radius, drop shadow. One definition so RecordingSettingsSheet,
 * UpgradeSheet, and the ExportControls mobile drawer share one shape.
 */
export const captureSheetSurface =
  'bg-[color:var(--sheet-bg)] rounded-4xl shadow-[0_-8px_40px_rgba(0,0,0,0.5)] ' +
  'data-[vaul-drawer-direction=bottom]:inset-x-auto data-[vaul-drawer-direction=bottom]:left-2.5 ' +
  'data-[vaul-drawer-direction=bottom]:right-2.5 data-[vaul-drawer-direction=bottom]:bottom-3.5';

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
      accent: 'border-l-4 border-l-acid-accent',
    },
  },
  defaultVariants: { variant: 'default' },
});

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
 * Acid body — Nunito. Friendly, readable, used for descriptions/controls.
 */
export const acidBody = cva('font-acid-body', {
  variants: {
    size: {
      lg: 'text-acid-body font-medium',
      default: 'text-acid-body',
      caption: 'text-acid-caption',
      footnote: 'text-acid-footnote tabular-nums',
    },
  },
  defaultVariants: { size: 'default' },
});

/**
 * Acid stat — the big Wrapped-style numeral ("12,483 clips exported").
 *
 * The size/leading/tracking triple already comes from `text-acid-stat`
 * (globals.css). What's left is the typographic treatment of the digits
 * themselves, which is a separate decision from the scale.
 */
export const acidStat = cva('font-acid-display text-acid-stat tabular-nums', {
  variants: {
    /**
     * `tabular-nums` is on the base, not a variant: these figures count up
     * on reveal, and proportional digits re-flow the line on every tick.
     * The spacing cost (a lone `1` sitting in a wide box) is worth not
     * having the layout jitter.
     */
    context: {
      /** Hero recap figure — the one big number on a screen. */
      hero: 'font-black',
      /** Inline card metric — sits next to other content, not alone. */
      inline: 'font-extrabold',
    },
  },
  defaultVariants: { context: 'hero' },
});

/**
 * Acid eyebrow — punchy uppercase label, replaces the old monospace eyebrow.
 * Uses the label size but the eyebrow's own tracking: all-caps has no
 * ascender/descender variation to separate glyphs, so its spacing is driven
 * by casing rather than size.
 */
export const acidEyebrow =
  'font-acid-body font-black text-acid-eyebrow uppercase text-acid-text-3';

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
        default: 'h-14 px-8 text-acid-body',
        sm: 'h-11 px-5 text-acid-label',
      },
    },
    defaultVariants: { size: 'default' },
  }
);

/**
 * Acid pill — selectable tab/option (e.g. control dock: Captions/Style/Trim/Reframe).
 */
/**
 * Onboarding auth tray buttons (mobile sign-up screen + desktop auth modal).
 * `apple` gets Apple's mandated light pill per HIG; `google` sits on the acid
 * dark surface system so the tray matches the desktop studio's palette.
 * These are the only two full-weight buttons — email sign-up/login is a
 * single tertiary link (see `authTrayLink`) so the tray reads as "one
 * decision, two ways" instead of a four-item menu.
 */
export const authTrayBtn = cva(
  'h-15.5 rounded-2xl flex items-center justify-center font-black text-[17px] ' +
  'tracking-[-0.01em] cursor-pointer transition-transform duration-150 active:scale-[0.985]',
  {
    variants: {
      variant: {
        apple: 'bg-white text-acid-bg-base',
        google: 'bg-acid-surface-3 text-acid-text-1',
      },
    },
    defaultVariants: { variant: 'google' },
  }
);

/**
 * Tertiary "continue with email" link beneath the auth tray buttons —
 * opens the same Clerk sign-up modal, which already offers its own
 * "already have an account? Sign in" link, so this single entry point
 * covers both new and returning users.
 */
export const authTrayLink =
  'h-11 flex items-center justify-center font-acid-body font-medium ' +
  'text-acid-label text-acid-text-2 cursor-pointer transition-colors ' +
  'duration-[var(--acid-duration-micro)] hover:text-acid-text-1';

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

/**
 * Gradient background picker swatch — same gradient values as shareCard's
 * sunset/electric variants (reused, not a new palette), plus acid-signal
 * (the app's own lime->cyan accent gradient token).
 */
export const gradientSwatch = cva('relative overflow-hidden rounded-xl', {
  variants: {
    variant: {
      sunset: 'bg-[linear-gradient(155deg,#FF8A4A_0%,#FF2E7E_55%,#B0165C_100%)]',
      electric: 'bg-[linear-gradient(155deg,#3A2BFF_0%,#4D7CFF_45%,#00D4FF_100%)]',
      'acid-signal': 'bg-[image:var(--acid-signal)]',
    },
  },
});

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
