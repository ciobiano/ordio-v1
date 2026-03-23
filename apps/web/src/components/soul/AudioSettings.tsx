'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { panelCard } from '@/lib/variants';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import type { EnhanceTier } from '@/lib/store';
import { useFeatureGates } from '@/hooks/useFeatureGates';
import LockBadge from '@/components/primitives/LockBadge';
import type { FeatureKey } from '@/lib/featureGates';

const tiers: readonly { value: EnhanceTier; label: string; description: string }[] = [
  { value: 'none', label: 'Standard', description: 'No server processing' },
  { value: 'clean', label: 'Clean', description: 'AI noise removal \u00b7 ~3s' },
  { value: 'hd', label: 'HD Remaster', description: 'Denoise + enhance \u00b7 ~15s' },
];

const tierFeatureKey: Partial<Record<EnhanceTier, FeatureKey>> = {
  clean: 'enhance_clean',
  hd: 'enhance_hd',
};

interface AudioSettingsProps {
  onLocked?: (feature: FeatureKey) => void;
}

export default function AudioSettings({ onLocked }: AudioSettingsProps) {
  const enhanceTier = useStore((s) => s.enhanceTier);
  const setEnhanceTier = useStore((s) => s.setEnhanceTier);
  const [isExpanded, setIsExpanded] = useState(false);
  const { isLocked } = useFeatureGates();

  return (
    <div className="w-full">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setIsExpanded((v) => !v)}
        aria-expanded={isExpanded}
        aria-controls="audio-settings-panel"
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-transparent
                   transition-colors duration-150 text-xs min-h-[44px] h-auto px-0"
      >
        <Image
          src="/icons/chevron-right.svg"
          width={14}
          height={14}
          alt=""
          aria-hidden="true"
          className={cn('invert opacity-50 transition-transform duration-200', isExpanded && 'rotate-90')}
        />
        Audio settings
      </Button>

      {isExpanded && (
        <div
          id="audio-settings-panel"
          className={cn(panelCard, 'mt-3 w-full px-4 py-4 animate-fadeIn')}
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
            Audio Quality
          </p>

          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Audio quality tier">
            {tiers.map(({ value, label, description }) => {
              const featureKey = tierFeatureKey[value];
              const locked = featureKey ? isLocked(featureKey) : false;
              const selected = enhanceTier === value;
              return (
                <div key={value} className="relative">
                  <label
                    className={cn(
                      'flex items-center gap-3 py-1.5 cursor-pointer transition-colors duration-150 min-h-[44px]',
                      'rounded-lg -mx-1 px-1',
                      selected ? 'bg-white/[0.02]' : 'hover:bg-white/[0.015]',
                    )}
                  >
                    <input
                      type="radio"
                      name="enhance-tier"
                      value={value}
                      checked={selected}
                      onChange={() => setEnhanceTier(value)}
                      className="sr-only"
                    />

                    {/* Radio indicator */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        'shrink-0 w-3.5 h-3.5 rounded-full border transition-all duration-150',
                        selected
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground bg-transparent',
                      )}
                    />

                    {/* Text */}
                    <span className="flex flex-col gap-px min-w-0">
                      <span
                        className={cn(
                          'text-xs transition-colors duration-150',
                          selected ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {label}
                      </span>
                      <span className="text-xs text-muted-foreground leading-tight">
                        {description}
                      </span>
                    </span>
                  </label>
                  {locked && featureKey && (
                    <LockBadge onClick={() => onLocked?.(featureKey)} label={`${label} requires Creator`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
