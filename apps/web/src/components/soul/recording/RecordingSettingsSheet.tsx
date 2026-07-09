'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { captureSheetSurface } from '@/lib/variants';
import { useUIStore, useProcessingStore } from '@/stores';
import { useFeatureGates } from '@/hooks/auth/useFeatureGates';
import LockBadge from '@/components/ui/LockBadge';
import type { FeatureKey } from '@/lib/featureGates';
import type {
  WaveformVariant,
  CanvasLayout,
  CaptionMode,
  EnhanceTier,
  GraphicStyleId,
} from '@/stores';

interface RecordingSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onLocked: (feature: FeatureKey) => void;
}

type GraphicVariant = NonNullable<GraphicStyleId>;

const WAVEFORM_OPTIONS: { value: WaveformVariant; label: string; gate?: FeatureKey }[] = [
  { value: 'bars', label: 'Bars' },
  { value: 'circle', label: 'Orbit', gate: 'waveform_circle' },
  { value: 'spectrogram', label: 'Spectrum', gate: 'waveform_spectrogram' },
  { value: 'none', label: 'Clean' },
];

const GRAPHIC_OPTIONS: { value: GraphicVariant; label: string }[] = [
  { value: 'graphic-frame1', label: 'Frame 1' },
  { value: 'graphic-frame2', label: 'Frame 2' },
];

const LAYOUT_OPTIONS: { value: CanvasLayout; label: string; gate?: FeatureKey }[] = [
  { value: 'top', label: 'Upper' },
  { value: 'compact', label: 'Tight' },
  { value: 'flipped', label: 'Lower', gate: 'layout_flipped' },
];

const MODE_OPTIONS: { value: CaptionMode; label: string; gate?: FeatureKey }[] = [
  { value: 'phrase', label: 'Pop' },
  { value: 'karaoke', label: 'Lyrics', gate: 'caption_karaoke' },
  { value: 'stack', label: 'Stack' },
  { value: 'spotlight', label: 'Spotlight' },
];

const ENHANCE_OPTIONS: { value: EnhanceTier; label: string; desc: string; gate?: FeatureKey }[] = [
  { value: 'none', label: 'Standard', desc: 'No processing' },
  { value: 'clean', label: 'Clean', desc: 'AI noise removal (~3s)', gate: 'enhance_clean' },
  { value: 'hd', label: 'HD Remaster', desc: 'Denoise + enhance (~15s)', gate: 'enhance_hd' },
];

// ── Segmented Control ────────────────────────────────────────────────────────
interface SegmentOption<T extends string> {
  value: T;
  label: string;
  gate?: FeatureKey;
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  onLocked,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  onLocked: (feature: FeatureKey) => void;
}) {
  const { isLocked } = useFeatureGates();
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const locked = opt.gate ? isLocked(opt.gate) : false;
        const isActive = value === opt.value;
        return (
          <Button
            key={opt.value}
            type="button"
            variant="ghost"
            className={cn(
              'relative shrink-0 px-4 py-2 text-sm transition-colors duration-150 min-h-9 h-auto rounded-full border',
              isActive
                ? 'bg-white/15 text-foreground font-semibold border-transparent hover:bg-white/20'
                : 'bg-transparent text-muted-foreground border-white/10 hover:bg-white/5 hover:text-foreground',
              locked && 'opacity-40'
            )}
            onClick={() => (locked ? onLocked(opt.gate!) : onChange(opt.value))}
          >
            {opt.label}
            {locked && opt.gate && (
              <LockBadge
                onClick={() => onLocked(opt.gate!)}
                label={`${opt.label} requires Creator`}
              />
            )}
          </Button>
        );
      })}
    </div>
  );
}

// ── Sheet ────────────────────────────────────────────────────────────────────
export function RecordingSettingsSheet({ isOpen, onClose, onLocked }: RecordingSettingsSheetProps) {
  const waveformStyle = useUIStore((s) => s.waveformStyle);
  const setWaveformStyle = useUIStore((s) => s.setWaveformStyle);
  const graphicStyle = useUIStore((s) => s.graphicStyle);
  const setGraphicStyle = useUIStore((s) => s.setGraphicStyle);
  const canvasLayout = useUIStore((s) => s.canvasLayout);
  const setCanvasLayout = useUIStore((s) => s.setCanvasLayout);
  const captionMode = useUIStore((s) => s.captionMode);
  const setCaptionMode = useUIStore((s) => s.setCaptionMode);
  const enhanceTier = useProcessingStore((s) => s.enhanceTier);
  const setEnhanceTier = useProcessingStore((s) => s.setEnhanceTier);
  const { isLocked } = useFeatureGates();
  const lyricsOwnsStage = captionMode === 'karaoke';

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
            {/* Waveform Style */}
            <section>
              <h3 className="text-xs font-semibold text-white/48 uppercase tracking-[0.13em] mb-3">
                Visual
              </h3>
              <div
                aria-disabled={lyricsOwnsStage}
                className={cn(lyricsOwnsStage && 'opacity-40 pointer-events-none')}
              >
                <SegmentedControl
                  options={WAVEFORM_OPTIONS}
                  value={waveformStyle}
                  onChange={(v) => {
                    setWaveformStyle(v);
                    setGraphicStyle(null);
                  }}
                  onLocked={onLocked}
                />
              </div>
              <div
                aria-disabled={lyricsOwnsStage}
                className={cn(lyricsOwnsStage && 'opacity-40 pointer-events-none')}
              >
                <p className="text-xs text-muted-foreground mt-3 mb-2">Frames</p>
                <SegmentedControl
                  options={GRAPHIC_OPTIONS}
                  value={graphicStyle ?? ('' as GraphicVariant)}
                  onChange={(v) => {
                    const next = graphicStyle === v ? null : v;
                    setGraphicStyle(next);
                    if (next !== null) setWaveformStyle('none');
                  }}
                  onLocked={onLocked}
                />
              </div>
            </section>

            <div className="h-px bg-white/8" />

            {/* Caption Layout */}
            <section>
              <h3 className="text-xs font-semibold text-white/48 uppercase tracking-[0.13em] mb-3">
                Stage
              </h3>
              <SegmentedControl
                options={LAYOUT_OPTIONS}
                value={canvasLayout}
                onChange={setCanvasLayout}
                onLocked={onLocked}
              />
              <p className="text-xs text-muted-foreground mt-3 mb-2">Caption</p>
              <SegmentedControl
                options={MODE_OPTIONS}
                value={captionMode}
                onChange={setCaptionMode}
                onLocked={onLocked}
              />
            </section>

            <div className="h-px bg-white/8" />

            {/* Audio Enhancement */}
            <section>
              <h3 className="text-xs font-semibold text-white/48 uppercase tracking-[0.13em] mb-3">
                Audio Enhancement
              </h3>
              <div>
                {ENHANCE_OPTIONS.map((opt, i) => {
                  const isActive = enhanceTier === opt.value;
                  return (
                    <Button
                      key={opt.value}
                      type="button"
                      variant="ghost"
                      className={cn(
                        'relative w-full flex items-center gap-3 py-3 text-left transition-colors duration-150 h-auto justify-start',
                        i < ENHANCE_OPTIONS.length - 1 && 'border-b border-white/8',
                        'rounded-lg px-2',
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
                      <div>
                        <div
                          className={cn(
                            'text-sm font-medium transition-colors duration-150',
                            isActive ? 'text-foreground' : 'text-muted-foreground'
                          )}
                        >
                          {opt.label}
                        </div>
                        <div className="text-xs text-muted-foreground">{opt.desc}</div>
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
