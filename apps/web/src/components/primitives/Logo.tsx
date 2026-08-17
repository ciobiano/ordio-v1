import { cn } from '@/lib/utils';
import { brandLogoDot, brandLogoWord, brandLogoLockup } from '@/lib/variants';

interface LogoProps {
  size?: 'sm' | 'lg';
  className?: string;
}

/**
 * The Ordio mark: lime dot + wordmark.
 *
 * Extracted from inside SplashShell, where it was a private function no other
 * surface could import. That inaccessibility had a cost — the desktop sign-in
 * gate rendered its own stand-in instead: a rounded square holding the letter
 * "O" on a hardcoded `linear-gradient(135deg,#C6FF3D,#6BE0FF)`. Two raw hexes
 * and an arbitrary Tailwind value for something the design system already had a
 * token for, and it was not even the same mark.
 *
 * One exported component means a second surface cannot invent a third version.
 */
export function Logo({ size = 'sm', className }: LogoProps) {
  return (
    <div className={cn(brandLogoLockup({ size }), className)}>
      <span className={brandLogoDot({ size })} aria-hidden="true" />
      <span className={brandLogoWord({ size })}>Ordio</span>
    </div>
  );
}
