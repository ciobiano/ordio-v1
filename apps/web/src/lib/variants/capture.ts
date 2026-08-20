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

export const captureNavBtn = `${captureGlossyBtn} w-9 h-9`;

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
export const captureRoundBtn = cva('shrink-0 w-10 h-10 rounded-full flex items-center justify-center', {
  variants: {
    tone: {
      neutral: `${captureGlossyBtn}`,
      primary: 'border-none cursor-pointer text-acid-on-accent bg-acid-accent',
      warning: 'cursor-pointer text-acid-warning bg-acid-warning/16 border border-acid-warning/50',
      success: 'cursor-pointer text-acid-success bg-acid-success/16 border border-acid-success/50',
      danger: 'cursor-pointer text-acid-error bg-acid-error/16 border border-acid-error/50',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

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
 * Shared silhouette for all bottom sheets/drawers — solid dark bg, floating
 * inset, large radius, drop shadow. One definition so RecordingSettingsSheet,
 * UpgradeSheet, and the ExportControls mobile drawer share one shape.
 */
export const captureSheetSurface =
  'bg-[color:var(--sheet-bg)] rounded-4xl shadow-[0_-8px_40px_rgba(0,0,0,0.5)] ' +
  'data-[vaul-drawer-direction=bottom]:inset-x-auto data-[vaul-drawer-direction=bottom]:left-2.5 ' +
  'data-[vaul-drawer-direction=bottom]:right-2.5 data-[vaul-drawer-direction=bottom]:bottom-3.5';
