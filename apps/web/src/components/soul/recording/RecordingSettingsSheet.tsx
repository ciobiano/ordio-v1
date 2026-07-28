'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { captureSheetSurface } from '@/lib/variants';
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
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent
        className={cn(captureSheetSurface, 'p-0 flex flex-col max-h-[50vh] overflow-hidden sm:left-1/2 sm:-translate-x-1/2 sm:max-w-[420px]')}
      >
        <DrawerTitle className="sr-only">Recording Settings</DrawerTitle>

        {/* Sticky header: drag handle + close — stays pinned while body scrolls */}
        <div className="sticky top-0 z-10 flex justify-center pt-3 pb-2 bg-[color:var(--sheet-bg)]">
          <div className="w-10 h-[5px] rounded-full bg-white/[0.28]" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close settings"
            onClick={onClose}
            className="absolute right-0 top-0 min-w-[44px] min-h-[44px] rounded-full hover:bg-transparent"
          >
            <span className="w-7 h-7 rounded-full bg-white/10 border border-white/10 flex items-center justify-center hover:bg-white/15 transition-colors duration-150">
              <Image
                src="/icons/close.svg"
                width={12}
                height={12}
                alt=""
                aria-hidden="true"
                className="invert opacity-55"
              />
            </span>
          </Button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 capture-scroll-thin">
          <div className="px-5 pb-8 space-y-6">
            {/* Audio Enhancement */}
            <section>
              <h3 className="text-xs font-semibold text-white/48 uppercase tracking-[0.13em] mb-3">
                Audio Enhancement
              </h3>
              <div className="rounded-acid-lg overflow-hidden border border-white/8">
                {ENHANCE_OPTIONS.map((opt, i) => {
                  const isActive = enhanceTier === opt.value;
                  return (
                    <Button
                      key={opt.value}
                      type="button"
                      variant="ghost"
                      className={cn(
                        'relative w-full flex items-center gap-acid-md px-acid-lg py-acid-md text-left transition-colors duration-150 h-auto min-h-[52px] justify-start rounded-none',
                        i < ENHANCE_OPTIONS.length - 1 && 'border-b border-white/8',
                        isActive ? 'bg-accent hover:bg-accent' : 'hover:bg-muted',
                        opt.gate && isLocked(opt.gate) && 'opacity-40'
                      )}
                      onClick={() =>
                        opt.gate && isLocked(opt.gate)
                          ? onLocked(opt.gate)
                          : setEnhanceTier(opt.value)
                      }
                    >
                      <div
                        className={cn(
                          'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-150',
                          isActive ? 'border-white/70 bg-white/70' : 'border-white/25'
                        )}
                      >
                        {isActive && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[color:var(--sheet-bg)]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div
                          className={cn(
                            'text-acid-label font-medium transition-colors duration-150',
                            isActive ? 'text-foreground' : 'text-muted-foreground'
                          )}
                        >
                          {opt.label}
                        </div>
                        <div className="text-acid-caption text-muted-foreground">{opt.desc}</div>
                      </div>
                      {opt.gate && isLocked(opt.gate) && (
                        <LockBadge
                          onClick={() => onLocked(opt.gate!)}
                          label={`${opt.label} requires Creator`}
                        />
                      )}
                    </Button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
