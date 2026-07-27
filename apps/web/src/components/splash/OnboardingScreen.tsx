'use client';

import { OnboardingAuthTray } from '@/components/soul/auth/OnboardingAuthTray';
import { useTypewriter } from '@/hooks/useTypewriter';
import { acidEyebrow, acidHeading } from '@/lib/variants';
import { SplashShell } from './SplashShell';

const PHRASES = [
  "Let's record",
  'Turn talk into captions',
  'Make an audiogram',
  'Ride the waveform',
  'Post your voice',
  'Caption every word',
];

/**
 * Mobile sign-up gate.
 *
 * The typewriter carries the six value props the old three-slide carousel used
 * to spread across separate screens, so collapsing to one screen doesn't cost
 * any of the pitch. The carousel's swipe handlers were `onTouchStart` /
 * `onTouchEnd` only with no pointer fallback, which made it unusable with a
 * mouse.
 */
export function OnboardingScreen() {
  const { text } = useTypewriter(PHRASES, true);

  return (
    <SplashShell
      orbClassName="scale-75"
      action={
        <OnboardingAuthTray redirectUrlComplete="/create" className="flex flex-col gap-3" />
      }
    >
      <p className={acidEyebrow}>Record. Transcribe. Share.</p>
      {/* min-h reserves two lines so the auth tray below doesn't shift as
          characters are typed in and deleted. */}
      <h1 className={`${acidHeading({ level: 'title' })} min-h-[2.2em]`} aria-live="polite">
        {text || ' '}
      </h1>
    </SplashShell>
  );
}
