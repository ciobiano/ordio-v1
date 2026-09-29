'use client';

import { useEffect } from 'react';
import { OrdSheet } from '@/components/ui/OrdSheet';
import { OrdioMark } from '@/components/ui/OrdioMark';
import { sheetButton } from '@/lib/variants';
import { useDirectorStore } from '@/stores';
import { useFeatureGates } from '@/hooks/auth/useFeatureGates';
import LockBadge from '@/components/ui/LockBadge';
import type { FeatureKey } from '@/lib/featureGates';
import { LOOK_PRESETS } from '@Ordio/engine';
import { DirectorLookCard } from './DirectorLookCard';

interface DirectorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onLocked: (feature: FeatureKey) => void;
}

export function DirectorSheet({ isOpen, onClose, onLocked }: DirectorSheetProps) {
  const { looks, isGenerating, error, generateLooks, reroll, applyLook } = useDirectorStore();
  const { isLocked } = useFeatureGates();
  const rerollLocked = isLocked('director_reroll');

  useEffect(() => {
    if (isOpen && !looks && !isGenerating && !error) {
      void generateLooks();
    }
  }, [isOpen, looks, isGenerating, error, generateLooks]);

  const handleSelectLook = (index: number) => {
    if (index > 0 && rerollLocked) {
      onLocked('director_reroll');
      return;
    }
    applyLook(index);
    onClose();
  };

  const handleReroll = () => {
    if (rerollLocked) {
      onLocked('director_reroll');
      return;
    }
    void reroll();
  };

  return (
    <OrdSheet
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Ordio Director"
      description="Three looks, read from your transcript. Tap one to apply it."
      showClose
      footer={
        looks && !isGenerating ? (
          <div className="relative">
            <button type="button" onClick={handleReroll} className={sheetButton({ tone: 'secondary' })}>
              Not feeling it — reroll
            </button>
            {rerollLocked && (
              <LockBadge onClick={() => onLocked('director_reroll')} label="Reroll requires Creator" />
            )}
          </div>
        ) : undefined
      }
    >
      {isGenerating && (
        <div className="flex flex-col items-center justify-center gap-4 py-8" role="status">
          <OrdioMark motion="pulse" size={120} className="text-acid-text-1" />
          <p className="m-0 text-sm text-acid-text-3">Directing your video…</p>
        </div>
      )}

      {error && !isGenerating && (
        <div className="flex flex-col items-center justify-center gap-3 py-6">
          <p className="m-0 text-sm text-acid-text-3">{error}</p>
          <button type="button" onClick={() => void generateLooks()} className={sheetButton({ tone: 'primary' })}>
            Try again
          </button>
        </div>
      )}

      {looks && !isGenerating && (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1" role="listbox" aria-label="Director looks and presets">
          {looks.map((look, index) => {
            const locked = index > 0 && rerollLocked;
            return (
              <div key={`${look.presetId}-${index}`} className="relative">
                <DirectorLookCard
                  look={look}
                  label={LOOK_PRESETS[look.presetId].label}
                  isSelected={false}
                  onSelect={() => handleSelectLook(index)}
                />
                {locked && <LockBadge onClick={() => onLocked('director_reroll')} label="Requires Creator" />}
              </div>
            );
          })}
        </div>
      )}
    </OrdSheet>
  );
}
