import Link from 'next/link'

const COLUMNS: { heading: string; links: string[] }[] = [
  { heading: 'Get Started', links: ['Open App', 'Pricing', 'Templates', 'Changelog'] },
  { heading: 'Product', links: ['Audiograms', 'AI Captions', 'Waveform Styles', 'MP4 Export', 'Audio Enhancement'] },
  { heading: 'Resources', links: ['Blog', 'Documentation', 'API Reference', 'Status'] },
  { heading: 'Company', links: ['About', 'Careers', 'Press', 'Contact'] },
  { heading: 'Legal', links: ['Privacy Policy', 'Terms of Service', 'Cookie Policy'] },
]

export function LandingFooter() {
  return (
    <footer className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-3 pt-12 sm:pt-20 pb-12 mt-10">
      {/* Link grid — responsive columns */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 mb-14">
        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <p className="text-xs font-semibold tracking-[0.09em] uppercase text-white/80 mb-3.5">
              {col.heading}
            </p>
            <ul className="flex flex-col gap-2.5">
              {col.links.map((item) => (
                <li key={item}>
                  <Link
                    href="#not-yet"
                    aria-disabled="true"
                    tabIndex={-1}
                    className="text-[length:var(--text-caption)] text-white/30 pointer-events-none"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0 pt-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-normal text-white/80">
          <svg width="20" height="20" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect width="28" height="28" rx="7" fill="#6366f1" />
            <rect x="5" y="13" width="3" height="10" rx="1.5" fill="white" />
            <rect x="10" y="9" width="3" height="14" rx="1.5" fill="white" />
            <rect x="15" y="6" width="3" height="17" rx="1.5" fill="white" />
            <rect x="20" y="10" width="3" height="13" rx="1.5" fill="white" />
          </svg>
          Ordio by kaine studio
        </Link>
        <span className="text-xs text-white/25">
          © {new Date().getFullYear()} Ordio. All rights reserved.
        </span>
        <div className="flex gap-5">
          <span aria-disabled="true" className="text-[length:var(--text-caption)] text-white/20">Twitter / X</span>
          <span aria-disabled="true" className="text-[length:var(--text-caption)] text-white/20">YouTube</span>
          <span aria-disabled="true" className="text-[length:var(--text-caption)] text-white/20">GitHub</span>
        </div>
      </div>
    </footer>
  )
}
