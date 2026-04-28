'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import ProgressRing from '@/components/primitives/status/ProgressRing';
import ProcessingStep from '@/components/primitives/status/ProcessingStep';
import { Button } from '@/components/ui/button';
import { useProcessingStore } from '@/stores';
import type { EnhanceTier } from '@/stores';
import { useHaptics } from '@/hooks/useHaptics';

interface ProcessingStateProps {
  progress: number;
  onCancel?: () => void;
}

function getSteps(tier: EnhanceTier): readonly string[] {
  if (tier === 'clean') {
    return ['Analyzing audio', 'Removing noise', 'Transcribing with AI', 'Preparing captions'];
  }
  if (tier === 'hd') {
    return ['Analyzing audio', 'Remastering audio', 'Transcribing with AI', 'Preparing captions'];
  }
  return ['Analyzing audio', 'Transcribing with AI', 'Preparing captions'];
}

function deriveStep(progress: number, tier: EnhanceTier): number {
  if (tier !== 'none') {
    // 4-step: decode 0-15, enhance 15-40, transcribe 40-75, finalize 75-100
    if (progress < 15) return 0;
    if (progress < 40) return 1;
    if (progress < 75) return 2;
    return 3;
  }
  // 3-step: decode 0-25, transcribe 25-70, finalize 70-100
  if (progress < 25) return 0;
  if (progress < 70) return 1;
  return 2;
}

const buttonSpring = {
  tap: { scale: 0.97, transition: { duration: 0.1 } },
  hover: { scale: 1.02, transition: { duration: 0.2 } },
};

export default function ProcessingState({ progress, onCancel }: ProcessingStateProps) {
  const enhanceTier = useProcessingStore((s) => s.enhanceTier);
  const { trigger } = useHaptics();
  const steps = getSteps(enhanceTier);
  const step = deriveStep(progress, enhanceTier);

  useEffect(() => {
    if (progress >= 100) {
      trigger('success');
    }
  }, [progress, trigger]);
  return (
    <div className="flex flex-col items-center gap-10 animate-fadeIn">
      <div className="text-center">
        <h2 className="text-[length:var(--text-h4)] font-light text-white tracking-[-0.02em]">
          Transcribing your audio
        </h2>
        <p className="text-white/45 text-sm mt-2">This won&apos;t take long</p>
      </div>

      <ProgressRing progress={progress} />

      <div className="flex flex-col items-start gap-3 w-full max-w-52">
        {steps.map((label, i) => (
          <ProcessingStep key={label} done={step > i} active={step === i && progress < 100}>
            {label}
          </ProcessingStep>
        ))}
      </div>

{onCancel && (
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          aria-label="Cancel processing"
          className="text-white/30 hover:text-white/50 hover:bg-transparent text-xs transition-colors h-auto py-1"
        >
          <motion.div
            whileTap={buttonSpring.tap}
            whileHover={buttonSpring.hover}
            className="flex items-center justify-center"
          >
            Cancel
          </motion.div>
        </Button>
      )}
    </div>
  );
}
