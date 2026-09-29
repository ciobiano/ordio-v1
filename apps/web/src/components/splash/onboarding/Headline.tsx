import { cn } from '@/lib/utils';

/** Geist bold with one Instrument Serif italic word — the onboarding voice. */
export function OnboardingHeadline({
  head,
  accent,
  breakBeforeAccent,
  as: Tag = 'h1',
  className,
}: {
  head: string;
  accent: string;
  breakBeforeAccent?: boolean;
  as?: 'h1' | 'h2';
  className?: string;
}) {
  return (
    <Tag className={cn('m-0 text-balance text-[33px] leading-[1.08] font-bold tracking-[-0.03em] text-acid-text-1 short:text-[29px]', className)}>
      {head}
      {breakBeforeAccent ? <br /> : ' '}
      <span className="font-acid-serif text-[1.2em] font-normal tracking-[-0.01em] italic">{accent}</span>
    </Tag>
  );
}

/** The step marks: three short bars, the current one taller and brighter. */
export function StepBars({
  step,
  count = 3,
  onPick,
}: {
  step: number;
  count?: number;
  onPick?: (index: number) => void;
}) {
  const bars = Array.from({ length: count }, (_, i) => i);
  if (!onPick) {
    return (
      <div role="img" aria-label={`Step ${step + 1} of ${count}`} className="flex h-4 items-center justify-center gap-1">
        {bars.map((i) => (
          <span key={i} className={cn('w-0.75 rounded-full', i === step ? 'h-3.5 bg-acid-text-1' : 'h-2 bg-acid-text-1/35')} />
        ))}
      </div>
    );
  }
  return (
    <div role="tablist" aria-label="Onboarding steps" className="flex h-11 items-center gap-1.5">
      {bars.map((i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === step}
          aria-label={`Step ${i + 1} of ${count}`}
          onClick={() => onPick(i)}
          className="flex h-11 w-5 cursor-pointer items-center justify-center border-none bg-transparent p-0"
        >
          <span className={cn('w-0.75 rounded-full', i === step ? 'h-3.5 bg-acid-text-1' : 'h-2 bg-acid-text-1/35')} />
        </button>
      ))}
    </div>
  );
}
