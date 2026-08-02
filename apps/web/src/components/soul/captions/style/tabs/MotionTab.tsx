'use client';

import { useUIStore } from '@/stores';
import { getCaptionStylePreset } from '@Ordio/engine';
import { CAPTION_ANIMATIONS } from '@/lib/captionAnimations';
import { useFeatureGates } from '@/hooks/auth/useFeatureGates';
import type { CaptionStyleId } from '@/stores';
import type { FeatureKey } from '@/lib/featureGates';
import { OptionCard } from '../primitives/OptionCard';

interface MotionTabProps {
  onLocked?: (feature: FeatureKey) => void;
}

/**
 * The four reveal mechanics the engine actually has. Selection matches on
 * `mechanic`, not on style id, so a Director look running a specialised bundle
 * (bold-outline, cream-block, …) still highlights the right row.
 */
export function MotionTab({ onLocked }: MotionTabProps) {
  const captionStyleId = useUIStore((s) => s.style.captionStyleId);
  const setStyle = useUIStore((s) => s.setStyle);
  const { isLocked } = useFeatureGates();

  const activeMechanic = getCaptionStylePreset(captionStyleId).mechanic;

  return (
    <div className="flex flex-col gap-2">
      {CAPTION_ANIMATIONS.map((option) => {
        const locked = option.gate ? isLocked(option.gate) : false;
        return (
          <OptionCard
            key={option.mechanic}
            label={option.label}
            hint={option.hint}
            active={activeMechanic === option.mechanic}
            locked={locked}
            onSelect={() => {
              if (locked && option.gate) {
                onLocked?.(option.gate);
                return;
              }
              setStyle({ captionStyleId: option.styleId as CaptionStyleId });
            }}
          />
        );
      })}
    </div>
  );
}
