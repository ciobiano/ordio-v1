'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { panelCard } from '@/lib/variants';
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
      <button
        onClick={() => setIsExpanded((v) => !v)}
        aria-expanded={isExpanded}
        aria-controls="audio-settings-panel"
        className="flex items-center gap-2 text-white/60 hover:text-white/80
                   transition-colors duration-150 cursor-pointer text-xs min-h-[44px]"
      >
        <svg
          className={cn('w-3.5 h-3.5 transition-transform duration-200', isExpanded && 'rotate-90')}
          fill="none"
          viewBox="0 0 16 16"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M6 3l5 5-5 5"
          />
        </svg>
        Audio settings
      </button>

      {isExpanded && (
        <div
          id="audio-settings-panel"
          className={cn(panelCard, 'mt-3 w-full px-4 py-4 animate-fadeIn')}
        >
          <p className="text-[0.625rem] uppercase tracking-widest text-white/50 mb-3">
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
                          ? 'border-blue-500/80 bg-blue-500/80'
                          : 'border-white/30 bg-transparent',
                      )}
                    />

                    {/* Text */}
                    <span className="flex flex-col gap-px min-w-0">
                      <span
                        className={cn(
                          'text-xs transition-colors duration-150',
                          selected ? 'text-white/80' : 'text-white/60',
                        )}
                      >
                        {label}
                      </span>
                      <span className="text-[0.625rem] text-white/50 leading-tight">
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
