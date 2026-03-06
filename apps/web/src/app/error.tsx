'use client';

import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[ordio]', error);
  }, [error]);

  return (
    <div className="min-h-dvh bg-black flex flex-col items-center justify-center px-4 text-center">
      <h2 className="text-[1.5rem] font-light text-white/90 tracking-[-0.02em]">
        Something went wrong
      </h2>
      <p className="text-white/35 text-sm mt-2 max-w-xs">
        An unexpected error occurred. Your recording is safe — try again.
      </p>
      <button
        onClick={reset}
        className="mt-8 px-5 py-2 text-sm text-white/70 rounded-full
                   bg-white/6 border border-white/8
                   hover:bg-white/10 transition-colors duration-150 cursor-pointer"
      >
        Try again
      </button>
    </div>
  );
}
