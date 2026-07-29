'use client';

import { useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { captureSheetSurface } from '@/lib/variants';
import { useUIStore, useDirectorStore } from '@/stores';
import { useFeatureGates } from '@/hooks/auth/useFeatureGates';
import LockBadge from '@/components/ui/LockBadge';
import type { FeatureKey } from '@/lib/featureGates';
import { LOOK_PRESETS, resolveLookStyle, type LookPresetId } from '@Ordio/engine';
import { DirectorLookCard } from './DirectorLookCard';

interface DirectorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onLocked: (feature: FeatureKey) => void;
}

export function DirectorSheet({ isOpen, onClose, onLocked }: DirectorSheetProps) {
  const { looks, isGenerating, error, generateLooks, reroll, applyLook } = useDirectorStore();
  const style = useUIStore((s) => s.style);
  const setStyle = useUIStore((s) => s.setStyle);
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

  const handleSelectPreset = (presetId: LookPresetId) => {
    setStyle(resolveLookStyle(style, presetId));
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
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent
        className={cn(captureSheetSurface, 'p-0 flex flex-col max-h-[70vh] overflow-hidden sm:left-1/2 sm:-translate-x-1/2 sm:max-w-[420px]')}
      >
        <DrawerTitle className="sr-only">Ordio Director</DrawerTitle>
        <DrawerDescription className="sr-only">
          AI-generated caption looks based on your transcript
        </DrawerDescription>

        <div className="sticky top-0 z-10 flex justify-center pt-3 pb-2 bg-[color:var(--sheet-bg)]">
          <div className="w-10 h-[5px] rounded-full bg-white/[0.28]" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close Director"
            onClick={onClose}
            className="absolute right-1 top-1 min-w-[44px] min-h-[44px] rounded-full hover:bg-transparent"
          >
            <span className="w-7 h-7 rounded-full bg-white/10 border border-white/10 flex items-center justify-center hover:bg-white/15 transition-colors duration-150">
              <HugeiconsIcon icon={Cancel01Icon} size={12} strokeWidth={2} className="opacity-55" />
            </span>
          </Button>
        </div>

        <div className="overflow-y-auto flex-1 capture-scroll-thin">
          <div className="px-5 pb-8 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">Ordio Director</h2>
              <p className="text-xs text-muted-foreground mt-1">
                3 looks generated from your transcript, tap to apply.
              </p>
            </div>

            {isGenerating && (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <p className="text-sm text-muted-foreground">Directing your video…</p>
              </div>
            )}

            {error && !isGenerating && (
              <div className="flex flex-col items-center justify-center py-6 gap-3">
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button type="button" onClick={() => void generateLooks()}>
                  Try again
                </Button>
              </div>
            )}

            {looks && !isGenerating && (
              <div className="flex gap-3 overflow-x-auto pb-2" role="listbox" aria-label="Director looks and presets">
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
                      {locked && (
                        <LockBadge
                          onClick={() => onLocked('director_reroll')}
                          label="Requires Creator"
                        />
                      )}
                    </div>
                  );
                })}

                <div className="flex w-px shrink-0 self-stretch bg-white/10" aria-hidden="true" />

                {(Object.keys(LOOK_PRESETS) as LookPresetId[]).map((presetId) => (
                  <DirectorLookCard
                    key={presetId}
                    look={{ presetId, style: resolveLookStyle(style, presetId), hookGroupIndex: -1 }}
                    label={LOOK_PRESETS[presetId].label}
                    isSelected={style.captionStyleId === LOOK_PRESETS[presetId].style.captionStyleId}
                    onSelect={() => handleSelectPreset(presetId)}
                  />
                ))}
              </div>
            )}

            {looks && !isGenerating && (
              <div className="relative flex justify-center">
                <Button type="button" variant="ghost" onClick={handleReroll}>
                  Reroll
                </Button>
                {rerollLocked && (
                  <LockBadge onClick={() => onLocked('director_reroll')} label="Reroll requires Creator" />
                )}
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
