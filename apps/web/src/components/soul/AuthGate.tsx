'use client';

import { useClerk } from '@clerk/nextjs';

export default function AuthGate() {
  const { openSignIn, openSignUp } = useClerk();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm text-center">

        <div className="mb-8">
          <p className="text-[0.6875rem] tracking-[0.3em] uppercase text-white/30 mb-3">
            ordio
          </p>
          <h1 className="text-[1.5rem] font-[600] text-white/90 leading-snug mb-3">
            Turn audio into video
          </h1>
          <p className="text-[0.875rem] text-white/40 leading-relaxed">
            Waveform clips with auto-captions, ready for social media.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => openSignUp()}
            className="w-full py-3 rounded-full bg-white text-black text-[0.875rem] font-[600]
                       hover:bg-white/92 transition-all duration-200 cursor-pointer
                       hover:scale-[1.02] active:scale-[0.98]"
          >
            Get started free
          </button>
          <button
            onClick={() => openSignIn()}
            className="w-full py-3 rounded-full border border-white/10 text-white/60
                       text-[0.875rem] font-[500] hover:border-white/20 hover:text-white/80
                       transition-all duration-150 cursor-pointer"
          >
            Sign in
          </button>
        </div>

      </div>
    </div>
  );
}
