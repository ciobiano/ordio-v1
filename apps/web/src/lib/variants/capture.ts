/**
 * Chrome for the recording screen — its buttons, hero and sheet.
 */

import { cva } from 'class-variance-authority';

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

/** 44px — the minimum touch target, and the size the approved capture design draws. */
export const captureNavBtn = `${captureGlossyBtn} w-11 h-11`;

/**
 * Idle-dock hero record button — the primary action, sized and colored like a
 * camera/voice-memo shutter so it can't be mistaken for an input field.
 */
export const captureRecordHero =
  'shrink-0 w-17 h-17 rounded-full flex items-center justify-center bg-acid-error text-white ' +
  'border-4 border-white/15 cursor-pointer transition-transform duration-150 active:scale-92';

/**
 * Round dock button — settings/stop/pause/play/restart/cancel, 40px (down from the mockup's
 * earlier 54-64px pass). Tone maps to what the action *means*, using the acid semantic
 * tokens instead of one undifferentiated red: `primary` (lime) for the confident "stop and
 * review" action, `warning` (amber) for pause, `success` (green) for resume, `danger` (red)
 * for restart since it discards the current take.
 */
export const captureRoundBtn = cva('shrink-0 rounded-full flex items-center justify-center transition-transform duration-150 active:scale-94', {
  variants: {
    /** `md` is the desk transport's 40px; `lg` is the phone dock's 56px thumb target. */
    size: {
      md: 'w-10 h-10',
      lg: 'w-14 h-14 short:w-12 short:h-12',
    },
    tone: {
      neutral: `${captureGlossyBtn}`,
      primary: 'border-none cursor-pointer text-acid-on-accent bg-acid-accent',
      warning: 'cursor-pointer text-acid-warning bg-acid-warning/16 border border-acid-warning/50',
      success: 'cursor-pointer text-acid-success bg-acid-success/16 border border-acid-success/50',
      danger: 'cursor-pointer text-acid-error bg-acid-error/16 border border-acid-error/50',
    },
  },
  defaultVariants: { tone: 'neutral', size: 'md' },
});

/**
 * The take's primary control while recording: a coral stop square inside a
 * ringed well, the shape every voice-memo app uses for "stop", so it is found
 * without reading the label.
 */
export const captureStopHero =
  'shrink-0 w-21 h-21 short:w-18 short:h-18 rounded-full flex items-center justify-center cursor-pointer ' +
  'bg-acid-bg-base border-3 border-acid-error/40 shadow-[0_0_0_8px_color-mix(in_srgb,var(--acid-error)_8%,transparent)] ' +
  'transition-transform duration-150 active:scale-94';

/** The lime commit pill, raised on its own darker lip — the sticker press. */
export const captureCommitPill =
  'h-14 short:h-12 flex-1 min-w-0 rounded-full border-none cursor-pointer bg-acid-accent text-acid-on-accent ' +
  'text-base font-semibold shadow-[0_3px_0_var(--acid-accent-lip)] transition-[transform,box-shadow] duration-100 ' +
  'active:translate-y-0.75 active:shadow-none';

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
