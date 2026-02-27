'use client';

import { useState } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { panelCard } from '@/lib/variants';
import { useStore } from '@/lib/store';
import type { StyleConfig } from '@Ordio/shared/schemas';

const fontBtn = cva(
  'px-3 py-1.5 rounded-lg text-xs border transition-all duration-100 cursor-pointer',
  {
    variants: {
      active: {
        true: 'bg-white/15 border-white/30 text-white',
        false: 'bg-white/[0.04] border-white/[0.08] text-white/45 hover:text-white/70 hover:bg-white/[0.08]',
      },
    },
    defaultVariants: { active: false },
  }
);

const FONTS: StyleConfig['fontFamily'][] = ['Inter', 'Roboto', 'Outfit'];

interface ColorRowProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function ColorRow({ label, value, onChange }: ColorRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/40 text-xs">{label}</span>
      <label className="flex items-center gap-2 cursor-pointer group" aria-label={`${label} color`}>
        <span className="text-white/25 text-xs tabular-nums uppercase">{value}</span>
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

export default function StyleControls() {
  const style = useStore((s) => s.style);
  const setStyle = useStore((s) => s.setStyle);
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="w-full">
      {/* Toggle */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        aria-expanded={isExpanded}
        aria-controls="style-controls-panel"
        className="flex items-center gap-2 text-white/30 hover:text-white/60
                   transition-colors duration-150 cursor-pointer text-xs"
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
        Style settings
      </button>

      {/* Panel */}
      {isExpanded && (
        <div
          id="style-controls-panel"
          className={cn(panelCard, 'mt-3 w-full px-4 py-4 flex flex-col gap-4 animate-fadeIn')}
        >
          {/* Colors */}
          <div className="flex flex-col gap-2.5">
            <p className="text-white/20 text-[0.625rem] uppercase tracking-[0.18em]">Colors</p>
            <ColorRow
              label="Waveform"
              value={style.waveColor}
              onChange={(v) => setStyle({ waveColor: v })}
            />
            <ColorRow
              label="Background"
              value={style.backgroundColor}
              onChange={(v) => setStyle({ backgroundColor: v })}
            />
            <ColorRow
              label="Text"
              value={style.textColor}
              onChange={(v) => setStyle({ textColor: v })}
            />
          </div>

          {/* Font */}
          <div className="flex flex-col gap-2">
            <p className="text-white/20 text-[0.625rem] uppercase tracking-[0.18em]">Font</p>
            <div className="flex gap-2">
              {FONTS.map((font) => (
                <button
                  key={font}
                  onClick={() => setStyle({ fontFamily: font })}
                  aria-pressed={style.fontFamily === font}
                  className={cn(fontBtn({ active: style.fontFamily === font }))}
                  style={{ fontFamily: font }}
                >
                  {font}
                </button>
              ))}
            </div>
          </div>

          {/* Font size */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-white/20 text-[0.625rem] uppercase tracking-[0.18em]">
                Font size
              </p>
              <span className="text-white/35 text-xs tabular-nums">{style.fontSize}px</span>
            </div>
            <input
              type="range"
              min={32}
              max={96}
              step={4}
              value={style.fontSize}
              onChange={(e) => setStyle({ fontSize: Number(e.target.value) })}
              aria-label="Font size"
              aria-valuemin={32}
              aria-valuemax={96}
              aria-valuenow={style.fontSize}
              className="w-full h-1 rounded-full accent-blue-500 cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
