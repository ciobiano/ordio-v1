import { cva } from 'class-variance-authority';

/**
 * Studio-only CVA variants. Accent is the existing `acid-text-1` off-white
 * token — never `acid-accent` (lime is mobile's signature, not Studio's).
 */
export const studioButton = cva(
  'inline-flex items-center justify-center h-9 px-4 rounded-acid-sm text-sm font-bold transition-colors',
  {
    variants: {
      variant: {
        primary: 'bg-acid-text-1 text-acid-bg-base hover:bg-white',
        secondary:
          'bg-acid-surface-1 text-acid-text-1 border border-acid-border-default hover:bg-acid-surface-2',
      },
    },
    defaultVariants: { variant: 'primary' },
  }
);

export const studioPill = cva(
  'px-3 py-1.5 rounded-acid-sm text-xs font-bold cursor-pointer transition-colors',
  {
    variants: {
      active: {
        true: 'bg-acid-text-1 text-acid-bg-base',
        false: 'bg-acid-surface-1 text-acid-text-2 hover:text-acid-text-1',
      },
    },
    defaultVariants: { active: false },
  }
);

export const studioCard = cva(
  'bg-acid-surface-1 border border-acid-border-subtle rounded-acid-md p-3.5 flex flex-col gap-3'
);

export const studioRailRow = cva(
  'relative flex items-center gap-3 px-2.5 py-2.5 rounded-acid-md cursor-pointer overflow-hidden transition-colors',
  {
    variants: {
      active: {
        true: 'bg-acid-text-1/10 border border-acid-text-1/30',
        false: 'border border-transparent hover:bg-acid-surface-1',
      },
    },
    defaultVariants: { active: false },
  }
);
