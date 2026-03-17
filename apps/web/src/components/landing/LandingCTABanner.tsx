import Link from 'next/link'

export function LandingCTABanner() {
  return (
    <div className="relative z-[1] flex justify-center px-4 lg:px-0 py-10 sm:py-15">
      <div className="relative w-full max-w-[1000px] lg:w-[1000px] grid grid-cols-1 md:grid-cols-[1fr_380px] border border-white/[0.12]">
        {/* Crosshairs — desktop only */}
        <Crosshair className="hidden sm:block top-[-10px] left-[-10px]" />
        <Crosshair className="hidden sm:block bottom-[-10px] right-[-10px]" />

        {/* Left column */}
        <div className="py-8 px-6 sm:py-13 sm:px-14 border-b border-white/[0.12] md:border-b-0 md:border-r-2 md:border-dashed md:border-white/[0.12]">
          <p className="text-[length:var(--text-body-xl)] font-normal text-white/55 leading-relaxed mb-6">
            Not sure which plan fits? Try{' '}
            <span className="text-[#6366f1]">Creator</span> or{' '}
            <span className="text-[#a855f7]">Pro</span> free for 14 days —<br />
            <strong className="text-white/90 font-normal">no credit card required.</strong>
          </p>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 px-5.5 py-2.5 rounded-full border border-white/[0.18] text-white/75 text-sm transition-all duration-150 hover:border-white/[0.38] hover:text-white hover:bg-white/[0.04]"
          >
            Start free trial &nbsp;&rarr;
          </Link>
        </div>

        {/* Right column */}
        <div className="py-8 px-6 sm:py-13 sm:px-11">
          <p className="text-base font-normal text-white/50 leading-relaxed mb-7">
            <strong className="text-white/90 font-semibold">Creators export in under 3 minutes.</strong>{' '}
            From recording to ready-to-post MP4 — no video editor needed.
          </p>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 px-5.5 py-2.5 rounded-full border border-white/[0.18] text-white/75 text-sm transition-all duration-150 hover:border-white/[0.38] hover:text-white hover:bg-white/[0.04]"
          >
            See how it works
          </Link>
        </div>
      </div>
    </div>
  )
}

function Crosshair({ className }: { className: string }) {
  return (
    <div className={`absolute w-5 h-5 pointer-events-none z-[5] ${className}`}>
      <div className="absolute left-1/2 top-0 bottom-0 w-[0.5px] bg-white/70 -translate-x-1/2" />
      <div className="absolute top-1/2 left-0 right-0 h-[0.5px] bg-white/70 -translate-y-1/2" />
    </div>
  )
}
