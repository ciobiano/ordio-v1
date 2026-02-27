import { cva } from 'class-variance-authority';

/**
 * Large primary pill button — white fill, used for main CTAs (Export, Download).
 */
export const primaryBtn =
  'w-full sm:w-auto px-10 py-3.5 bg-white text-black rounded-full ' +
  'text-[0.9375rem] font-[600] tracking-[-0.01em] ' +
  'hover:bg-white/92 transition-all duration-200 ' +
  'hover:scale-[1.02] active:scale-[0.98] cursor-pointer ' +
  'shadow-[0_8px_32px_rgba(255,255,255,0.08)]';

/**
 * Ghost text button — no background, muted label that brightens on hover.
 * Used for secondary actions (upload link, cancel, "create another").
 */
export const ghostBtn =
  'text-white/30 text-sm hover:text-white/60 transition-colors duration-150 cursor-pointer';

/**
 * Circular icon button — used for mic (idle) and stop (recording).
 * The `intent` variant controls color scheme.
 */
export const roundIconBtn = cva(
  'group relative w-[4.5rem] h-[4.5rem] rounded-full ' +
    'transition-all duration-200 hover:scale-105 active:scale-[0.96] cursor-pointer',
  {
    variants: {
      intent: {
        idle: 'bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15]',
        stop: 'bg-[#e11d48]/[0.12] border-2 border-[#e11d48]/30 hover:bg-[#e11d48]/20 hover:border-[#e11d48]/50',
      },
    },
    defaultVariants: { intent: 'idle' },
  }
);

/**
 * Panel/card container — glass surface used for editors and settings panels.
 */
export const panelCard = 'rounded-2xl bg-white/[0.03] border border-white/[0.06]';
