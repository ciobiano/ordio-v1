'use client';

import { useAuth, useClerk, useUser } from '@clerk/nextjs';
import { OnboardingCarousel } from './OnboardingCarousel';
import { SlideToContinue } from './SlideToContinue';
import { useNavigate, useOverlayLoading } from '@/components/NavigationTransition';
import BarsWaveform from '@/components/primitives/waveform/BarsWaveform';

export function SplashScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const { openSignUp } = useClerk();
  const { user } = useUser();
  const { navigate } = useNavigate();
  useOverlayLoading(!isLoaded);

  const logo = (
    <div className="absolute top-5 left-5 flex items-center gap-2 z-10">
      <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="3" fill="rgba(255,255,255,0.9)" />
          <circle cx="7" cy="7" r="6" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        </svg>
      </div>
      <span className="text-sm font-bold tracking-tight text-white">Ordio</span>
    </div>
  );

  // Ambient waveform — visual anchor for the upper 60% of canvas
  const ambientWaveform = (
    <div className="absolute top-0 left-0 right-0 h-3/5 flex items-center justify-center">
      <BarsWaveform level={0} isRecording={false} />
    </div>
  );

  if (!isLoaded) return null;

  if (isSignedIn) {
    return (
      <main className="min-h-dvh bg-black flex items-center justify-center">
        <div className="relative w-full max-w-sm min-h-dvh overflow-hidden">
          {logo}
          {ambientWaveform}
          <div className="absolute bottom-36 left-6 right-6">
            <p className="text-xs text-white/45 mb-1.5">Welcome back</p>
            <h1 className="text-3xl font-light leading-snug tracking-tight text-white">
              Ready to<br /><strong className="font-bold">create</strong> again?
            </h1>
          </div>
          <div className="absolute bottom-0 left-0 right-0">
            <SlideToContinue
              onComplete={() => navigate('/create')}
              userName={user?.firstName ?? undefined}
            />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-black flex items-center justify-center">
      <div className="relative w-full max-w-sm min-h-dvh overflow-hidden">
        {logo}
        {ambientWaveform}
        <OnboardingCarousel onCTA={() => openSignUp()} />
      </div>
    </main>
  );
}
