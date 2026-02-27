'use client';

import ProgressRing from '@/components/primitives/ProgressRing';
import ProcessingStep from '@/components/primitives/ProcessingStep';

interface ProcessingStateProps {
  progress: number;
}

const STEPS = [
  'Analyzing audio',
  'Transcribing with AI',
  'Preparing captions',
] as const;

function deriveStep(progress: number): number {
  if (progress < 25) return 0;
  if (progress < 70) return 1;
  return 2;
}

export default function ProcessingState({ progress }: ProcessingStateProps) {
  const step = deriveStep(progress);
  return (
    <div
      className="flex flex-col items-center gap-10 animate-fadeIn"
      role="status"
      aria-label={`Processing: ${Math.round(progress)}%`}
    >
      <div className="text-center">
        <h2 className="text-[1.5rem] font-[300] text-white/90 tracking-[-0.02em]">
          Creating your video
        </h2>
        <p className="text-white/35 text-sm mt-2">This won&apos;t take long</p>
      </div>

      <ProgressRing progress={progress} />

      <div className="flex flex-col items-start gap-3 w-[13rem]">
        {STEPS.map((label, i) => (
          <ProcessingStep key={label} done={step > i} active={step === i && progress < 100}>
            {label}
          </ProcessingStep>
        ))}
      </div>
    </div>
  );
}
