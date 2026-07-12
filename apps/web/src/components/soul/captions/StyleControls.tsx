'use client';

import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { loadFont } from '@/lib/loaders';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUIStore } from '@/stores';
import type { StyleConfig } from '@Ordio/shared/schemas';
import type { CaptionAnimation } from '@/stores';
import { useFeatureGates } from '@/hooks/auth/useFeatureGates';
import LockBadge from '@/components/ui/LockBadge';
import type { FeatureKey } from '@/lib/featureGates';
import { BackgroundVideoPicker } from './BackgroundVideoPicker';

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

const MOTION_ROWS: { value: CaptionAnimation; title: string; subtitle: string }[] = [
  { value: 'none', title: 'Static', subtitle: 'No motion' },
  { value: 'sweep', title: 'Reveal', subtitle: 'Phrase sweep' },
  { value: 'pulse', title: 'Breathe', subtitle: 'Scale pulse' },
  { value: 'sweep-pulse', title: 'Reveal + Breathe', subtitle: 'Sweep with pulse' },
];

const LINE_SPACING_BASE = 1;
const MIN_LINE_SPACING = -0.6;
const MAX_LINE_SPACING = 1.4;
const MIN_CHARACTER_SPACING = -12;
const MAX_CHARACTER_SPACING = 12;
const STYLE_TABS = ['colors', 'font', 'spacing', 'motion'] as const;

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

interface MotionRowProps {
  value: CaptionAnimation;
  title: string;
  subtitle: string;
  selected: boolean;
  onSelect: () => void;
}

function MotionRow({ value, title, subtitle, selected, onSelect }: MotionRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex min-h-11 w-full flex-col items-stretch gap-0.5 rounded-xl border px-2.5 py-2 text-left transition-colors duration-150',
        selected
          ? 'border-white/16 bg-white/[0.1] text-white'
          : 'border-white/[0.08] bg-white/[0.03] text-white/74 hover:bg-white/[0.06] hover:text-white/90'
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium leading-tight">{title}</span>
        <span
          className={cn(
            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full transition-opacity duration-150',
            selected ? 'bg-white text-black opacity-100' : 'opacity-0'
          )}
          aria-hidden="true"
        >
          <HugeiconsIcon icon={Tick02Icon} size={13} strokeWidth={2.3} />
        </span>
      </div>
      <span className="hidden truncate pl-0 text-left text-[11px] text-white/42 min-[380px]:inline">{subtitle}</span>
      <span className="sr-only">{value}</span>
    </button>
  );
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
  const [activeTab, setActiveTab] = useState<StyleTab>('colors');
  const [previousTab, setPreviousTab] = useState<StyleTab>('colors');
  const style = useUIStore((s) => s.style);
  const setStyle = useUIStore((s) => s.setStyle);
  const captionAnimation = useUIStore((s) => s.captionAnimation);
  const setCaptionAnimation = useUIStore((s) => s.setCaptionAnimation);
  const { isLocked } = useFeatureGates();
  const reduceMotion = useReducedMotion();
  const lineSpacing = (style.lineHeight ?? 1.4) - LINE_SPACING_BASE;
  const slideDirection = useMemo(() => {
    return STYLE_TABS.indexOf(activeTab) >= STYLE_TABS.indexOf(previousTab) ? 1 : -1;
  }, [activeTab, previousTab]);

  useEffect(() => {
    void Promise.allSettled(FONTS.map((font) => loadFont(font)));
  }, []);

  const handleTabChange = (value: string) => {
    const nextTab = value as StyleTab;
    if (!STYLE_TABS.includes(nextTab) || nextTab === activeTab) return;
    setPreviousTab(activeTab);
    setActiveTab(nextTab);
  };

  const renderActiveTab = () => {
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
          <BackgroundVideoPicker onLocked={onLocked} />
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

    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Caption motion (phrase mode)">
          {MOTION_ROWS.map(({ value, title, subtitle }) => {
            const selected = captionAnimation === value;
            return (
              <MotionRow
                key={value}
                value={value}
                title={title}
                subtitle={subtitle}
                selected={selected}
                onSelect={() => setCaptionAnimation(value)}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="flex h-full min-h-0 flex-col gap-3 overflow-hidden"
    >
      <TabsList variant="default" className="h-9 w-full shrink-0">
        <TabsTrigger value="colors" className="text-xs flex-1">
          Colors
        </TabsTrigger>
        <TabsTrigger value="font" className="text-xs flex-1">
          Font
        </TabsTrigger>
        <TabsTrigger value="spacing" className="text-xs flex-1">
          Spacing
        </TabsTrigger>
        <TabsTrigger value="motion" className="text-xs flex-1">
          Motion
        </TabsTrigger>
      </TabsList>
      <div
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-0.5 pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]"
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
