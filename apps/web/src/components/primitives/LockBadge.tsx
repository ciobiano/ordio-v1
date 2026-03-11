'use client';

interface LockBadgeProps {
  onClick: () => void;
  label?: string;
}

/**
 * Small padlock overlay for locked features.
 * Parent must have `position: relative`.
 */
export default function LockBadge({ onClick, label = 'Locked feature' }: LockBadgeProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      className="absolute inset-0 z-10 flex items-center justify-center
                 rounded-inherit cursor-pointer group"
    >
      <span
        className="flex items-center justify-center w-5 h-5 rounded-full
                   bg-black/50 backdrop-blur-sm border border-white/20
                   group-hover:bg-black/70 transition-colors duration-150"
        aria-hidden="true"
      >
        <svg
          className="w-2.5 h-2.5 text-white/70"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M5 7V5a3 3 0 016 0v2M4 7h8a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z"
          />
        </svg>
      </span>
    </button>
  );
}
