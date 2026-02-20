'use client';

import ProgressRing from '@/components/primitives/ProgressRing';
import ProcessingStep from '@/components/primitives/ProcessingStep';

interface ProcessingStateProps {
  progress: number;
}

export default function ProcessingState({ progress }: ProcessingStateProps) {
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
        <ProcessingStep done={progress > 25} active={progress <= 25 && progress > 0}>
          Analyzing audio
        </ProcessingStep>
        <ProcessingStep done={progress > 45} active={progress > 25 && progress <= 45}>
          Generating transcript
        </ProcessingStep>
        <ProcessingStep done={progress > 70} active={progress > 45 && progress <= 70}>
          Rendering waveform
        </ProcessingStep>
        <ProcessingStep done={progress > 90} active={progress > 70 && progress <= 90}>
          Encoding video
        </ProcessingStep>
        <ProcessingStep done={progress === 100} active={progress > 90 && progress < 100}>
          Finalizing
        </ProcessingStep>
      </div>
    </div>
  );
}
