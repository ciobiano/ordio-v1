'use client';

interface ProgressRingProps {
  progress: number;
}

export default function ProgressRing({ progress }: ProgressRingProps) {
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  return (
    <div
      className="relative w-[9rem] h-[9rem]"
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Processing: ${Math.round(progress)}%`}
    >
      <svg className="w-full h-full -rotate-90" viewBox="0 0 144 144">
        <circle
          cx="72" cy="72" r={radius}
          fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3"
        />
        <circle
          cx="72" cy="72" r={radius}
          fill="none" stroke="url(#progressGrad)" strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress / 100)}
          className="transition-all duration-150"
        />
        <defs>
          <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-3xl font-[300] tabular-nums tracking-[-0.03em]">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
}
