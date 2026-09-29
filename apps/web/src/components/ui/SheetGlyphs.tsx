/** Round tinted badges that sit beside a sheet's title. */

export function DangerBadge({ kind }: { kind: 'bin' | 'alert' }) {
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-acid-error/12 text-acid-error">
      {kind === 'bin' ? (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M3.5 5h11M7.5 5V3.5h3V5M5 5l.7 9.5h6.6L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9 5.5v4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="9" cy="12.3" r="0.9" fill="currentColor" />
        </svg>
      )}
    </span>
  );
}

/** The radio mark at the end of a sheet option row. */
export function RadioDot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        on
          ? 'flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full border-2 border-acid-accent'
          : 'flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-acid-text-1/25'
      }
    >
      {on && <span className="h-2.5 w-2.5 rounded-full bg-acid-accent" />}
    </span>
  );
}
