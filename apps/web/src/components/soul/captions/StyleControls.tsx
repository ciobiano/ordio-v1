'use client';

import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { loadFont } from '@Ordio/engine/loaders';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUIStore } from '@/stores';
import type { StyleConfig } from '@Ordio/shared/schemas';
import type { CaptionStyleId, GraphicStyleId, WaveformVariant } from '@/stores';
import { getCaptionStylePreset } from '@Ordio/engine';
import { useFeatureGates } from '@/hooks/auth/useFeatureGates';
import LockBadge from '@/components/ui/LockBadge';
import type { FeatureKey } from '@/lib/featureGates';
import { BackgroundVideoPicker } from './BackgroundVideoPicker';
import { BackgroundImagePicker } from './BackgroundImagePicker';
import { CanvasPresetPicker } from './CanvasPresetPicker';

const FONTS: StyleConfig['fontFamily'][] = [
  'Inter', 'Roboto', 'Outfit',
  'Poppins', 'Montserrat', 'Space Grotesk', 'DM Sans', 'Playfair Display', 'Lora',
];

const FONT_LABELS: Record<StyleConfig['fontFamily'], string> = {
  Inter: 'Neutral',
  Roboto: 'Clean',
  Outfit: 'Rounded',
  Poppins: 'Modern',
  Montserrat: 'Editorial',
  'Space Grotesk': 'Technical',
  'DM Sans': 'Soft',
  'Playfair Display': 'Display',
  Lora: 'Serif',
};

const fontFeatureKey: Partial<Record<StyleConfig['fontFamily'], FeatureKey>> = {
  Poppins: 'font_poppins',
  Montserrat: 'font_montserrat',
  'Space Grotesk': 'font_space_grotesk',
  'DM Sans': 'font_dm_sans',
  'Playfair Display': 'font_playfair',
};

const MODE_OPTIONS: { value: CaptionStyleId; label: string; gate?: FeatureKey }[] = [
  { value: 'word-pop', label: 'Pop' },
  { value: 'bold-outline', label: 'Outline' },
  { value: 'karaoke-chip', label: 'Karaoke' },
  { value: 'minimal-lower-third', label: 'Minimal' },
  { value: 'big-statement', label: 'Statement' },
  { value: 'script-accent', label: 'Script' },
];

const DISPLAY_OPTIONS: { value: WaveformVariant | 'graphics'; label: string; gate?: FeatureKey }[] = [
  { value: 'bars', label: 'Bars' },
  { value: 'circle', label: 'Orbit', gate: 'waveform_circle' },
  { value: 'spectrogram', label: 'Spectrum', gate: 'waveform_spectrogram' },
  { value: 'none', label: 'Clean' },
  { value: 'graphics', label: 'Frames' },
];

const GRAPHICS_OPTIONS: { value: Exclude<GraphicStyleId, null>; label: string }[] = [
  { value: 'graphic-frame1', label: 'Frame 1' },
  { value: 'graphic-frame2', label: 'Frame 2' },
];

const LINE_SPACING_BASE = 1;
const MIN_LINE_SPACING = -0.6;
const MAX_LINE_SPACING = 1.4;
const MIN_CHARACTER_SPACING = -12;
const MAX_CHARACTER_SPACING = 12;
const MIN_STROKE_WIDTH = 0;
const MAX_STROKE_WIDTH = 8;
const MIN_GLOW_INTENSITY = 0;
const MAX_GLOW_INTENSITY = 1;
const STYLE_TABS = ['preset', 'colors', 'font', 'spacing', 'visual'] as const;

type StyleTab = (typeof STYLE_TABS)[number];

interface StyleControlsProps {
  onLocked?: (feature: FeatureKey) => void;
}

interface ColorRowProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function ColorRow({ label, value, onChange }: ColorRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <label className="flex items-center gap-2 cursor-pointer group min-h-11" aria-label={`${label} color`}>
        <span className="text-muted-foreground text-xs tabular-nums uppercase">{value}</span>
        <div
          className="w-6 h-6 rounded-md border border-white/20 overflow-hidden
                     group-hover:border-white/40 transition-colors duration-150 shrink-0"
          style={{ backgroundColor: value }}
          aria-hidden="true"
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
          aria-label={`Pick ${label} color`}
        />
      </label>
    </div>
  );
}

interface SliderRowProps {
  label: string;
  valueLabel: string;
  minLabel: string;
  maxLabel: string;
  sliderProps: ComponentProps<typeof Slider>;
}

function SliderRow({ label, valueLabel, minLabel, maxLabel, sliderProps }: SliderRowProps) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[18px] border border-white/[0.08] bg-white/[0.03] px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium tracking-[0.01em] text-white/74">{label}</span>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.05] px-2 py-0.5 text-[11px] tabular-nums text-white/62">
          {valueLabel}
        </span>
      </div>
      <Slider {...sliderProps} />
      <div className="flex items-center justify-between text-[10px] tracking-[0.02em] text-white/36">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

interface FontRowProps {
  font: StyleConfig['fontFamily'];
  selected: boolean;
  locked: boolean;
  featureKey?: FeatureKey;
  onSelect: () => void;
  onLocked?: (feature: FeatureKey) => void;
}

function FontRow({ font, selected, locked, featureKey, onSelect, onLocked }: FontRowProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          'flex min-h-11 w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors duration-150',
          selected
            ? 'border-white/16 bg-white/[0.1] text-white'
            : 'border-white/[0.08] bg-white/[0.03] text-white/74 hover:bg-white/[0.06] hover:text-white/90'
        )}
      >
        <span
          className="min-w-0 flex-1 truncate text-[15px] leading-none"
          style={{ fontFamily: `"${font}", sans-serif` }}
        >
          {font}
        </span>
        <span className="hidden shrink-0 text-[11px] text-white/42 min-[380px]:inline">{FONT_LABELS[font]}</span>
        <span
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-full transition-opacity duration-150',
            selected ? 'bg-white text-black opacity-100' : 'opacity-0'
          )}
          aria-hidden="true"
        >
          <HugeiconsIcon icon={Tick02Icon} size={13} strokeWidth={2.3} />
        </span>
      </button>
      {locked && featureKey && (
        <LockBadge onClick={() => onLocked?.(featureKey)} label={`${font} requires Creator`} />
      )}
    </div>
  );
}

export default function StyleControls({ onLocked }: StyleControlsProps) {
  const [activeTab, setActiveTab] = useState<StyleTab>('preset');
  const [previousTab, setPreviousTab] = useState<StyleTab>('preset');
  const style = useUIStore((s) => s.style);
  const setStyle = useUIStore((s) => s.setStyle);
  const waveformStyle = useUIStore((s) => s.waveformStyle);
  const setWaveformStyle = useUIStore((s) => s.setWaveformStyle);
  const graphicStyle = useUIStore((s) => s.graphicStyle);
  const setGraphicStyle = useUIStore((s) => s.setGraphicStyle);
  const [graphicsExpanded, setGraphicsExpanded] = useState(false);
  // Which background-source tab is showing — independent of what's actually
  // applied, so switching tabs to browse doesn't change the canvas until a
  // tile is tapped. Seeded from the current background so it opens on the
  // right tab, not always defaulting to Preset.
  const [bgSource, setBgSource] = useState<'preset' | 'video' | 'image'>(() =>
    style.background?.type === 'video' ? 'video' : style.background?.type === 'image' ? 'image' : 'preset'
  );
  const { isLocked } = useFeatureGates();
  const reduceMotion = useReducedMotion();
  const lineSpacing = (style.lineHeight ?? 1.4) - LINE_SPACING_BASE;
  const activeStylePreset = getCaptionStylePreset(style.captionStyleId);
  // "Full-stage" lyric presets own the whole canvas, so a separate waveform
  // visual doesn't apply — same rule StageControlBar's Visual picker used.
  const lyricsOwnsStage = activeStylePreset.mechanic === 'static-highlight';
  const slideDirection = useMemo(() => {
    return STYLE_TABS.indexOf(activeTab) >= STYLE_TABS.indexOf(previousTab) ? 1 : -1;
  }, [activeTab, previousTab]);

  useEffect(() => {
    void Promise.allSettled(FONTS.map((font) => loadFont(font)));
  }, []);

  useEffect(() => {
    if (activeTab !== 'visual') setGraphicsExpanded(false);
  }, [activeTab]);

  const handleTabChange = (value: string) => {
    const nextTab = value as StyleTab;
    if (!STYLE_TABS.includes(nextTab) || nextTab === activeTab) return;
    setPreviousTab(activeTab);
    setActiveTab(nextTab);
  };

  const renderActiveTab = () => {
    if (activeTab === 'preset') {
      return (
        <div className="flex flex-col gap-1.5">
          {MODE_OPTIONS.map((option) => {
            const locked = option.gate ? isLocked(option.gate) : false;
            const isSelected = style.captionStyleId === option.value;
            return (
              <div key={option.value} className="relative">
                <button
                  type="button"
                  disabled={locked}
                  aria-pressed={isSelected}
                  onClick={() => !locked && setStyle({ captionStyleId: option.value })}
                  className={cn(
                    'flex min-h-11 w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-[15px] transition-colors duration-150',
                    isSelected
                      ? 'border-white/16 bg-white/[0.1] text-white'
                      : 'border-white/[0.08] bg-white/[0.03] text-white/74 hover:bg-white/[0.06] hover:text-white/90',
                    locked && 'opacity-50'
                  )}
                >
                  <span>{option.label}</span>
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full transition-opacity duration-150',
                      isSelected ? 'bg-white text-black opacity-100' : 'opacity-0'
                    )}
                    aria-hidden="true"
                  >
                    <HugeiconsIcon icon={Tick02Icon} size={13} strokeWidth={2.3} />
                  </span>
                </button>
                {locked && option.gate && (
                  <LockBadge onClick={() => onLocked?.(option.gate!)} label={`${option.label} requires Creator`} />
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (activeTab === 'colors') {
      return (
        <div className="flex flex-col gap-2.5">
          <ColorRow label="Waveform" value={style.waveColor} onChange={(v) => setStyle({ waveColor: v })} />
          <ColorRow
            label="Background"
            value={style.backgroundColor}
            onChange={(v) =>
              // Picking a color also reverts a video background to solid
              setStyle({ backgroundColor: v, background: { type: 'solid', color: v } })
            }
          />
          <ColorRow label="Text" value={style.textColor} onChange={(v) => setStyle({ textColor: v })} />
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-xs">Background</span>
            <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1">
              {(
                [
                  { id: 'preset', label: 'Preset' },
                  { id: 'video', label: 'Video' },
                  { id: 'image', label: 'Image' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={bgSource === tab.id}
                  onClick={() => setBgSource(tab.id)}
                  className={cn(
                    'flex-1 rounded-lg py-1.5 text-[13px] transition-colors duration-150',
                    bgSource === tab.id
                      ? 'bg-white/[0.12] text-white'
                      : 'text-white/50 hover:text-white/75'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {bgSource === 'preset' && <CanvasPresetPicker />}
            {bgSource === 'video' && <BackgroundVideoPicker onLocked={onLocked} />}
            {bgSource === 'image' && <BackgroundImagePicker onLocked={onLocked} />}
          </div>

          {/* Morphs based on the active caption style — stroke/glow controls only
              appear for styles whose preset actually uses them (bold-outline,
              script-accent), not shown for every style at once. */}
          {activeStylePreset.stroke && (
            <>
              <ColorRow
                label="Stroke"
                value={style.strokeColor ?? activeStylePreset.stroke.defaultColor}
                onChange={(v) => setStyle({ strokeColor: v })}
              />
              <SliderRow
                label="Stroke width"
                valueLabel={`${((style.strokeWidth ?? activeStylePreset.stroke.defaultWidth) * 100).toFixed(0)}%`}
                minLabel="Thin"
                maxLabel="Thick"
                sliderProps={{
                  min: MIN_STROKE_WIDTH,
                  max: MAX_STROKE_WIDTH,
                  step: 0.01,
                  value: [style.strokeWidth ?? activeStylePreset.stroke.defaultWidth],
                  onValueChange: (val) =>
                    setStyle({ strokeWidth: Array.isArray(val) ? val[0] : val }),
                  'aria-label': 'Stroke width',
                }}
              />
            </>
          )}

          {activeStylePreset.glow && (
            <>
              <ColorRow
                label="Glow"
                value={style.glowColor ?? activeStylePreset.glow.defaultColor}
                onChange={(v) => setStyle({ glowColor: v })}
              />
              <SliderRow
                label="Glow intensity"
                valueLabel={`${Math.round((style.glowIntensity ?? activeStylePreset.glow.defaultIntensity) * 100)}%`}
                minLabel="Subtle"
                maxLabel="Strong"
                sliderProps={{
                  min: MIN_GLOW_INTENSITY,
                  max: MAX_GLOW_INTENSITY,
                  step: 0.01,
                  value: [style.glowIntensity ?? activeStylePreset.glow.defaultIntensity],
                  onValueChange: (val) =>
                    setStyle({ glowIntensity: Array.isArray(val) ? val[0] : val }),
                  'aria-label': 'Glow intensity',
                }}
              />
            </>
          )}
        </div>
      );
    }

    if (activeTab === 'font') {
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-1.5">
            {FONTS.map((font) => {
              const featureKey = fontFeatureKey[font];
              const locked = featureKey ? isLocked(featureKey) : false;
              return (
                <FontRow
                  key={font}
                  font={font}
                  selected={style.fontFamily === font}
                  locked={locked}
                  featureKey={featureKey}
                  onSelect={() => setStyle({ fontFamily: font })}
                  onLocked={onLocked}
                />
              );
            })}
          </div>
          <SliderRow
            label="Font size"
            valueLabel={`${style.fontSize}px`}
            minLabel="Small"
            maxLabel="Large"
            sliderProps={{
              min: 32,
              max: 96,
              step: 1,
              value: [style.fontSize],
              onValueChange: (val) => setStyle({ fontSize: Array.isArray(val) ? val[0] : val }),
              'aria-label': 'Font size',
            }}
          />
        </div>
      );
    }

    if (activeTab === 'spacing') {
      return (
        <div className="flex flex-col gap-3">
          <SliderRow
            label="Line spacing"
            valueLabel={lineSpacing.toFixed(2)}
            minLabel="Tight"
            maxLabel="Loose"
            sliderProps={{
              min: MIN_LINE_SPACING,
              max: MAX_LINE_SPACING,
              step: 0.01,
              value: [lineSpacing],
              onValueChange: (val) => {
                const spacingValue = Array.isArray(val) ? val[0] : val;
                setStyle({ lineHeight: Math.max(0.4, LINE_SPACING_BASE + spacingValue) });
              },
              'aria-label': 'Line spacing',
            }}
          />
          <SliderRow
            label="Character spacing"
            valueLabel={`${(style.characterSpacing ?? 0).toFixed(2)}px`}
            minLabel="Tighter"
            maxLabel="Wider"
            sliderProps={{
              min: MIN_CHARACTER_SPACING,
              max: MAX_CHARACTER_SPACING,
              step: 0.1,
              value: [style.characterSpacing ?? 0],
              onValueChange: (val) => {
                const next = Array.isArray(val) ? val[0] : val;
                setStyle({ characterSpacing: Number(next.toFixed(2)) });
              },
              'aria-label': 'Character spacing',
            }}
          />
        </div>
      );
    }

    if (activeTab === 'visual') {
      if (lyricsOwnsStage) {
        return (
          <p className="px-1 py-4 text-center text-[13px] text-white/45">
            Full-stage caption styles use the whole canvas — visual style doesn&apos;t apply.
          </p>
        );
      }

      return (
        <div className="flex flex-col gap-1.5">
          {DISPLAY_OPTIONS.map((option) => {
            const locked = option.gate ? isLocked(option.gate) : false;
            const isSelected =
              option.value === 'graphics'
                ? graphicStyle !== null
                : graphicStyle === null && waveformStyle === option.value;

            return (
              <div key={option.value}>
                <button
                  type="button"
                  disabled={locked}
                  aria-pressed={isSelected}
                  onClick={() => {
                    if (option.value === 'graphics') {
                      setGraphicsExpanded((current) => !current);
                      return;
                    }
                    setGraphicStyle(null);
                    setWaveformStyle(option.value);
                    setGraphicsExpanded(false);
                  }}
                  className={cn(
                    'flex min-h-11 w-full items-center rounded-xl border px-3 py-2 text-left text-[15px] transition-colors duration-150',
                    isSelected
                      ? 'border-white/16 bg-white/[0.1] text-white'
                      : 'border-white/[0.08] bg-white/[0.03] text-white/74 hover:bg-white/[0.06] hover:text-white/90',
                    locked && 'opacity-50'
                  )}
                >
                  <span className="flex-1 text-left">{option.label}</span>
                  {option.value === 'graphics' && (
                    <span
                      className={cn(
                        'mr-1 inline-flex h-4 w-4 items-center justify-center text-white/45 transition-transform duration-200',
                        graphicsExpanded && 'rotate-90'
                      )}
                      aria-hidden="true"
                    >
                      ›
                    </span>
                  )}
                  {locked && option.gate && (
                    <LockBadge onClick={() => onLocked?.(option.gate!)} label={`${option.label} requires Creator`} />
                  )}
                  <span
                    className={cn(
                      'ml-2 flex size-5 shrink-0 items-center justify-center rounded-full transition-opacity duration-150',
                      isSelected ? 'bg-white text-black opacity-100' : 'opacity-0'
                    )}
                    aria-hidden="true"
                  >
                    <HugeiconsIcon icon={Tick02Icon} size={13} strokeWidth={2.3} />
                  </span>
                </button>

                {option.value === 'graphics' && (
                  <div
                    className={cn(
                      'grid overflow-hidden transition-[grid-template-rows,opacity] duration-200',
                      graphicsExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    )}
                  >
                    <div className="min-h-0">
                      <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-2">
                        {GRAPHICS_OPTIONS.map((graphic) => (
                          <button
                            key={graphic.value}
                            type="button"
                            onClick={() => {
                              setGraphicStyle(graphic.value);
                              setGraphicsExpanded(false);
                            }}
                            className={cn(
                              'flex h-8 w-full items-center rounded-md px-3 text-sm transition-colors duration-200',
                              graphicStyle === graphic.value
                                ? 'bg-white/10 text-white'
                                : 'text-white/60 hover:bg-white/5'
                            )}
                          >
                            {graphic.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    return null;
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="flex h-full min-h-0 flex-col gap-3 overflow-hidden"
    >
      <TabsList variant="default" className="h-9 w-full shrink-0">
        <TabsTrigger value="preset" className="text-xs flex-1">
          Preset
        </TabsTrigger>
        <TabsTrigger value="colors" className="text-xs flex-1">
          Colors
        </TabsTrigger>
        <TabsTrigger value="font" className="text-xs flex-1">
          Font
        </TabsTrigger>
        <TabsTrigger value="spacing" className="text-xs flex-1">
          Spacing
        </TabsTrigger>
        <TabsTrigger value="visual" className="text-xs flex-1">
          Visual
        </TabsTrigger>
      </TabsList>
      <div
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-0.5 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tabpanel"
        aria-label={`${activeTab} style controls`}
      >
        <AnimatePresence mode="wait" custom={slideDirection} initial={false}>
          <motion.div
            key={activeTab}
            custom={slideDirection}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: slideDirection * 14 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: slideDirection * -14 }}
            transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
            className="w-full pb-2"
          >
            {renderActiveTab()}
          </motion.div>
        </AnimatePresence>
      </div>
    </Tabs>
  );
}
