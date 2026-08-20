/**
 * Anything the user presses: buttons, pressable rows, links that act.
 */

import { cva, type VariantProps } from 'class-variance-authority';

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
  'h-15.5 rounded-2xl flex items-center justify-center gap-2.5 font-black text-[length:var(--text-body-lg)] ' +
  'tracking-[-0.01em] cursor-pointer transition-transform duration-150 active:scale-[0.985] ' +
  // An OAuth handoff is a redirect, so these stay disabled until the browser
  // leaves the page — there is no success state to return to.
  'disabled:cursor-not-allowed disabled:active:scale-100',
  {
    variants: {
      variant: {
        apple: 'bg-white text-acid-bg-base',
        google: 'bg-acid-surface-3 text-acid-text-1',
      },
      /**
       * `waiting` is the button you pressed; `blocked` is every other button,
       * disabled so a second provider cannot be started mid-handoff. They are
       * dimmed differently on purpose — identical treatment would lose track of
       * which provider is actually working.
       */
      state: {
        idle: '',
        waiting: 'disabled:opacity-100',
        blocked: 'disabled:opacity-40',
      },
    },
    defaultVariants: { variant: 'google', state: 'idle' },
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
  'duration-[var(--acid-duration-micro)] hover:text-acid-text-1 ' +
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-acid-text-2';

/**
 * Spinner for a pending auth handoff. `currentColor` so it reads on both tray
 * buttons — the Apple one is white-on-dark, the Google one dark-on-surface, and a
 * fixed colour would vanish on one of them.
 */
export const authTraySpinner =
  'h-4.5 w-4.5 shrink-0 animate-spin rounded-full border-2 ' +
  'border-current/25 border-t-current';

/* ------------------------------------------------------------------ *
 * Sticker button — the design's signature press.
 * ------------------------------------------------------------------ */

export const ordStickerBtn = cva(
  'inline-flex items-center justify-center gap-2 cursor-pointer font-semibold ' +
    'transition-transform duration-[var(--acid-dur-tap)] ease-[var(--acid-ease-snap)] ' +
    'motion-reduce:transition-none ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--acid-accent-ring)] ' +
    'disabled:opacity-40 disabled:cursor-not-allowed',
  {
    variants: {
      /**
       * Declared BEFORE `tone` on purpose. CVA emits variant classes in key
       * order, so anything a tone needs to override (premiumSoft's rule) has to
       * come after the elevation that would otherwise win on merge order.
       */
      elevation: {
        /**
         * The signature press. A hard ink offset, no blur, and on press the
         * element travels 3px into its own shadow as the shadow vanishes —
         * physical movement, never an opacity dim.
         *
         * For things sitting on the canvas or the page: the Add FAB, Export.
         */
        raised:
          'border-[3px] border-[color:var(--acid-bg-base)] shadow-[var(--acid-shadow-sticker-sm)] ' +
          'active:translate-x-[3px] active:translate-y-[3px] active:shadow-none ' +
          'motion-reduce:active:translate-x-0 motion-reduce:active:translate-y-0 ' +
          'disabled:active:translate-x-0 disabled:active:translate-y-0',
        /**
         * For anything inside a sheet, drawer or panel.
         *
         * A sticker needs a surface to peel off. The shadow is `--acid-bg-base`
         * (#0a0b0a), which reads against the page and all but vanishes against
         * `--sheet-bg` (#141517) — so in a sheet you got the 3px ink border
         * reading as a gap and no peel to show for it. A sheet is also already
         * the raised layer; lifting a button off it is a second claim on the
         * same depth.
         */
        flat: 'shadow-none active:scale-[0.97] motion-reduce:active:scale-100 disabled:active:scale-100',
      },
      tone: {
        accent: 'bg-[color:var(--acid-accent)] text-[color:var(--acid-on-accent)]',
        premium: 'bg-[color:var(--acid-premium)] text-[color:var(--acid-on-accent)]',
        paper: 'bg-[color:var(--acid-text-1)] text-[color:var(--acid-on-accent)]',
        /**
         * Tinted rather than filled — a wash of the accent behind a solid rule
         * of it. For a button that sits among the transport controls and should
         * read as available without shouting over the artwork behind it.
         *
         * Carries its own rule because it is the one tone that is an outline;
         * pair it with `elevation: 'flat'`, which is the only combination that
         * makes sense.
         */
        premiumSoft:
          'bg-[color:var(--acid-premium)]/15 text-[color:var(--acid-premium)] ' +
          'border-2 border-[color:var(--acid-premium)]/55 ' +
          'hover:bg-[color:var(--acid-premium)]/25',
      },
      shape: { pill: 'rounded-full', square: 'rounded-2xl', round: 'rounded-full' },
      size: {
        sm: 'h-11 px-4 text-sm',
        md: 'h-[46px] px-5 text-[length:var(--text-body-lg)]',
        lg: 'h-12 px-6 text-[length:var(--text-body)]',
        icon: 'w-12 h-12 p-0',
      },
    },
    defaultVariants: { elevation: 'raised', tone: 'accent', shape: 'pill', size: 'md' },
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
      size: { sm: 'h-[38px] px-4 text-xs', md: 'h-11 px-4 text-sm', lg: 'h-12 px-4 text-[length:var(--text-body)]' },
    },
    defaultVariants: { size: 'md' },
  }
);

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
 * Tool strip button — one icon in the floating vertical strip.
 *
 * Open is ink at full weight, never lime. The open panel is already the
 * loudest possible signal that a tool is selected, and DESIGN.md bans the
 * accent from marking position for exactly this reason: a lime button beside
 * an open lime-free panel doubles a signal that was not ambiguous.
 *
 * Hover is declared per state on purpose. A single hover rule out-specified
 * the open rule once before and painted near-white on near-white.
 */
export const deskToolButton = cva(
  'ord-tool-btn transition-colors duration-[var(--dur-tap)] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)] ' +
    'disabled:cursor-default disabled:opacity-35',
  {
    variants: {
      open: {
        true: 'bg-[var(--ord-paper)] text-[var(--ord-ink)] enabled:hover:bg-[var(--ord-paper)]',
        false:
          'bg-transparent text-[var(--text-muted)] enabled:hover:bg-[var(--ord-paper)]/10 enabled:hover:text-[var(--ord-paper)]',
      },
    },
    defaultVariants: { open: false },
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

export type DeskToolButtonProps = VariantProps<typeof deskToolButton>;
export type IconButtonProps = VariantProps<typeof iconButton>;
export type SolidButtonProps = VariantProps<typeof solidButton>;
