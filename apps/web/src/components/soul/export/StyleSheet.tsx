// apps/web/src/components/soul/export/StyleSheet.tsx
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { exportSheetSurface } from '@/lib/variants';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useUIStore } from '@/stores';
import { useFeatureGates } from '@/hooks/auth/useFeatureGates';
import LockBadge from '@/components/ui/LockBadge';
import type { FeatureKey } from '@/lib/featureGates';
import type { CanvasLayout, CaptionMode, GraphicStyleId, WaveformVariant } from '@/stores';

interface StyleSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onLocked: (feature: FeatureKey) => void;
}

const WAVEFORM_OPTIONS: { value: WaveformVariant; label: string; gate?: FeatureKey }[] = [
  { value: 'bars', label: 'Bars' },
  { value: 'circle', label: 'Orbit', gate: 'waveform_circle' },
  { value: 'spectrogram', label: 'Spectrum', gate: 'waveform_spectrogram' },
  { value: 'none', label: 'Clean' },
];

const GRAPHIC_OPTIONS: { value: Exclude<GraphicStyleId, null>; label: string }[] = [
  { value: 'graphic-frame1', label: 'Frame 1' },
  { value: 'graphic-frame2', label: 'Frame 2' },
];

const MODE_OPTIONS: { value: CaptionMode; label: string; gate?: FeatureKey }[] = [
  { value: 'phrase', label: 'Pop' },
  { value: 'karaoke', label: 'Lyrics', gate: 'caption_karaoke' },
  { value: 'stack', label: 'Stack' },
  { value: 'spotlight', label: 'Spotlight' },
];

const LAYOUT_OPTIONS: { value: CanvasLayout; label: string; gate?: FeatureKey }[] = [
  { value: 'top', label: 'Upper' },
  { value: 'compact', label: 'Tight' },
  { value: 'flipped', label: 'Lower', gate: 'layout_flipped' },
];

function OptionRow<T extends string>({
  label,
  value,
  selected,
  locked,
  gate,
  onSelect,
  onLocked,
}: {
  label: string;
  value: T;
  selected: boolean;
  locked: boolean;
  gate?: FeatureKey;
  onSelect: (v: T) => void;
  onLocked: (feature: FeatureKey) => void;
}) {
  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => onSelect(value)}
      className={cn(
        'w-full flex items-center justify-between px-5 py-3 text-left text-white border-b border-white/10 last:border-b-0',
        selected && 'bg-white/8',
        locked && 'opacity-50'
      )}
    >
      <span className="text-[15px]">{label}</span>
      {locked && gate && <LockBadge onClick={() => onLocked(gate)} label={`${label} requires Creator`} />}
    </button>
  );
}

export function StyleSheet({ isOpen, onClose, onLocked }: StyleSheetProps) {
  const waveformStyle = useUIStore((s) => s.waveformStyle);
  const setWaveformStyle = useUIStore((s) => s.setWaveformStyle);
  const graphicStyle = useUIStore((s) => s.graphicStyle);
  const setGraphicStyle = useUIStore((s) => s.setGraphicStyle);
  const captionMode = useUIStore((s) => s.captionMode);
  const setCaptionMode = useUIStore((s) => s.setCaptionMode);
  const canvasLayout = useUIStore((s) => s.canvasLayout);
  const setCanvasLayout = useUIStore((s) => s.setCanvasLayout);
  const { isLocked } = useFeatureGates();
  const [section, setSection] = useState<'visual' | 'caption' | 'stage'>('visual');
  const lyricsOwnsStage = captionMode === 'karaoke';

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          'border-none bg-transparent gap-0 shadow-none min-h-0 h-auto max-h-[75vh]',
          'data-[side=bottom]:inset-x-auto data-[side=bottom]:w-auto',
          'data-[side=bottom]:left-2.5 data-[side=bottom]:right-2.5 data-[side=bottom]:bottom-3.5'
        )}
      >
        <div className="flex gap-1.5 mb-2.5 rounded-full bg-white/6 border border-white/14 p-1">
          {(['visual', 'caption', 'stage'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSection(s)}
              className={cn(
                'flex-1 h-9 rounded-full text-[13px] font-semibold text-white/60',
                section === s && 'bg-white/12 text-white'
              )}
            >
              {s === 'visual' ? 'Visual' : s === 'caption' ? 'Caption' : 'Stage'}
            </button>
          ))}
        </div>

        <div className={exportSheetSurface}>
          {section === 'visual' &&
            (lyricsOwnsStage ? (
              <div className="px-5 py-4 text-white/45 text-[14px]">Full-stage lyrics mode active</div>
            ) : (
              <>
                {WAVEFORM_OPTIONS.map((o) => (
                  <OptionRow
                    key={o.value}
                    label={o.label}
                    value={o.value}
                    selected={graphicStyle === null && waveformStyle === o.value}
                    locked={o.gate ? isLocked(o.gate) : false}
                    gate={o.gate}
                    onSelect={(v) => {
                      setGraphicStyle(null);
                      setWaveformStyle(v);
                    }}
                    onLocked={onLocked}
                  />
                ))}
                {GRAPHIC_OPTIONS.map((o) => (
                  <OptionRow
                    key={o.value}
                    label={o.label}
                    value={o.value}
                    selected={graphicStyle === o.value}
                    locked={false}
                    onSelect={setGraphicStyle}
                    onLocked={onLocked}
                  />
                ))}
              </>
            ))}

          {section === 'caption' &&
            MODE_OPTIONS.map((o) => (
              <OptionRow
                key={o.value}
                label={o.label}
                value={o.value}
                selected={captionMode === o.value}
                locked={o.gate ? isLocked(o.gate) : false}
                gate={o.gate}
                onSelect={setCaptionMode}
                onLocked={onLocked}
              />
            ))}

          {section === 'stage' &&
            LAYOUT_OPTIONS.map((o) => (
              <OptionRow
                key={o.value}
                label={o.label}
                value={o.value}
                selected={canvasLayout === o.value}
                locked={o.gate ? isLocked(o.gate) : false}
                gate={o.gate}
                onSelect={setCanvasLayout}
                onLocked={onLocked}
              />
            ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-2.5 py-4 rounded-[28px] bg-white/6 border border-white/14 text-white text-lg font-semibold"
        >
          Done
        </button>
      </SheetContent>
    </Sheet>
  );
}
