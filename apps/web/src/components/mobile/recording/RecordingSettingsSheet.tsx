'use client';

import { cn } from '@/lib/utils';
import { OrdSheet, OrdSheetLabel } from '@/components/ui/OrdSheet';
import { RadioDot } from '@/components/ui/SheetGlyphs';
import { sheetOption } from '@/lib/variants';
import { useProcessingStore } from '@/stores';
import { useFeatureGates } from '@/hooks/auth/useFeatureGates';
import LockBadge from '@/components/ui/LockBadge';
import type { FeatureKey } from '@/lib/featureGates';
import type { EnhanceTier } from '@/stores';

interface RecordingSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onLocked: (feature: FeatureKey) => void;
}

const ENHANCE_OPTIONS: { value: EnhanceTier; label: string; desc: string; gate?: FeatureKey }[] = [
  { value: 'none', label: 'Standard', desc: 'No processing' },
  { value: 'clean', label: 'Clean', desc: 'AI noise removal (~3s)', gate: 'enhance_clean' },
  { value: 'hd', label: 'HD Remaster', desc: 'Denoise + enhance (~15s)', gate: 'enhance_hd' },
];

// ── Sheet ────────────────────────────────────────────────────────────────────
// Recording-time settings are narrowed to what's actually relevant mid-recording
// — audio enhancement. Waveform/frame/layout/caption style live in ExportState's
// StageControlBar instead, where the styled canvas is actually visible to judge
// against; picking them blind during capture (no preview) just duplicated a
// choice the user makes again, informed, at export.
export function RecordingSettingsSheet({ isOpen, onClose, onLocked }: RecordingSettingsSheetProps) {
  const enhanceTier = useProcessingStore((s) => s.enhanceTier);
  const setEnhanceTier = useProcessingStore((s) => s.setEnhanceTier);
  const { isLocked } = useFeatureGates();

  return (
    <OrdSheet
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Recording settings"
      description="Applies to this take when it is processed"
      showClose
    >
      <OrdSheetLabel>Audio enhancement</OrdSheetLabel>
      <div role="radiogroup" aria-label="Audio enhancement" className="-mt-1 flex flex-col gap-2">
        {ENHANCE_OPTIONS.map((opt) => {
          const isActive = enhanceTier === opt.value;
          const locked = opt.gate ? isLocked(opt.gate) : false;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              className={cn(sheetOption({ selected: isActive }), locked && 'opacity-55')}
              onClick={() => (opt.gate && locked ? onLocked(opt.gate) : setEnhanceTier(opt.value))}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-medium text-acid-text-1">{opt.label}</span>
                <span className="text-[13px] text-acid-text-3">{opt.desc}</span>
              </span>
              {locked && opt.gate ? (
                <LockBadge onClick={() => onLocked(opt.gate!)} label={`${opt.label} requires Creator`} />
              ) : (
                <RadioDot on={isActive} />
              )}
            </button>
          );
        })}
      </div>
    </OrdSheet>
  );
}
