'use client';

import { useAuth, useClerk, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { OnboardingCarousel } from './OnboardingCarousel';
import { SlideToContinue } from './SlideToContinue';

export function SplashScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const { openSignUp } = useClerk();
  const { user } = useUser();
  const router = useRouter();

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

  if (!isLoaded) {
    return (
      <main className="min-h-dvh bg-black flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border border-white/20 border-t-white/60 animate-spin" />
      </main>
    );
  }

  if (isSignedIn) {
    return (
      <main className="min-h-dvh bg-black relative overflow-hidden">
        {logo}
        <div className="absolute bottom-36 left-6 right-6">
          <p className="text-xs text-white/45 mb-1.5">Welcome back</p>
          <h1 className="text-3xl font-light leading-snug tracking-tight text-white">
            Ready to<br /><strong className="font-bold">create</strong> again?
          </h1>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <SlideToContinue
            onComplete={() => router.push('/create')}
            userName={user?.firstName ?? undefined}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-black relative overflow-hidden">
      {logo}
      <OnboardingCarousel onCTA={() => openSignUp()} />
    </main>
  );
}
