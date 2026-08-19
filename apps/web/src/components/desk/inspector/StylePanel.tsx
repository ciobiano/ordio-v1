'use client';

/** Caption style — the design's largest panel, split across four tabs. */

import { cn } from '@/lib/utils';
import { chip } from '@/lib/desk/deskVariants';
import type { DeskState, StyleTab } from '@/lib/desk/deskState';
import type { BreakMode } from '@Ordio/engine/captions/breaks';
import { ANIMS, FONTS, PRESETS, VISUALS } from '@/lib/desk/deskCatalog';
import {
  ChipRow,
  ColourField,
  PanelBody,
  Section,
  SliderField,
  ToggleField,
} from './InspectorFields';

const TABS: { id: StyleTab; label: string }[] = [
  { id: 'animation', label: 'Motion' },
  { id: 'type', label: 'Type' },
  { id: 'colour', label: 'Colour' },
  { id: 'layout', label: 'Layout' },
];

const BREAK_MODES: { id: BreakMode; label: string }[] = [
  { id: 'punct', label: 'Punctuation' },
  { id: 'quantity', label: 'Word count' },
  { id: 'time', label: 'Time' },
  { id: 'single', label: 'One word' },
  { id: 'random', label: 'Varied' },
];

interface StylePanelProps {
  state: DeskState;
  patch: (patch: Partial<DeskState>, undoable?: boolean) => void;
}

export function StylePanel({ state, patch }: StylePanelProps) {
  return (
    <>
      <div className="flex flex-none gap-1 px-[18px] pb-2.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => patch({ styleTab: tab.id })}
            className={chip({ selected: state.styleTab === tab.id, size: 'sm' })}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <PanelBody>
        {state.styleTab === 'animation' && (
          <>
            <Section label="Caption presets">
              <div className="grid grid-cols-3 gap-1.5">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      patch(
                        {
                          preset: preset.id,
                          font: preset.font,
                          capCase: preset.textCase,
                          textColor: preset.text,
                          activeWordBg: preset.wordBg,
                          activeWordColor: preset.wordText,
                          strokeW: preset.stroke,
                          anim: preset.anim,
                        },
                        true
                      )
                    }
                    className={cn(
                      'flex h-[54px] flex-col items-center justify-center gap-1 rounded-[10px] border transition-colors',
                      state.preset === preset.id
                        ? 'border-[var(--ord-acid)] bg-[var(--ord-acid)]/12'
                        : 'border-[var(--border-hairline)] bg-[var(--ord-paper)]/5'
                    )}
                  >
                    <span className="ord-type-footnote font-bold text-[var(--ord-paper)]">
                      {preset.name}
                    </span>
                    <span className="ord-mono ord-type-micro">{preset.sample}</span>
                  </button>
                ))}
              </div>
            </Section>

            <Section label="Animation">
              <div className="flex flex-col gap-1">
                {ANIMS.map((anim) => (
                  <button
                    key={anim.id}
                    type="button"
                    onClick={() => patch({ anim: anim.id }, true)}
                    className={cn(
                      'flex flex-col gap-0.5 rounded-[10px] border px-3 py-2 text-left transition-colors',
                      state.anim === anim.id
                        ? 'border-[var(--ord-acid)] bg-[var(--ord-acid)]/12'
                        : 'border-[var(--border-hairline)] bg-[var(--ord-paper)]/5'
                    )}
                  >
                    <span className="ord-type-footnote font-bold text-[var(--ord-paper)]">
                      {anim.label}
                    </span>
                    <span className="font-[family-name:var(--font-display)] ord-type-footnote text-[var(--text-muted)]">
                      {anim.hint}
                    </span>
                  </button>
                ))}
              </div>
            </Section>

            <Section label="Break on">
              <ChipRow
                options={BREAK_MODES}
                value={state.breakMode}
                onChange={(id) => patch({ breakMode: id })}
              />
              {state.breakMode === 'quantity' && (
                <ChipRow
                  options={[2, 3, 4, 5, 6].map((n) => ({
                    id: String(n),
                    label: `${n} words`,
                  }))}
                  value={String(state.breakQty)}
                  onChange={(id) => patch({ breakQty: Number(id) })}
                />
              )}
              {state.breakMode === 'time' && (
                <SliderField
                  label="Hold each caption"
                  value={state.breakSecs}
                  readout={`${state.breakSecs.toFixed(1)}s`}
                  min={1}
                  max={6}
                  step={0.5}
                  onChange={(v) => patch({ breakSecs: v })}
                />
              )}
              <ToggleField
                label="Apply to all phrases"
                hint="Off means this caption only"
                checked={state.applyAll}
                onChange={(v) => patch({ applyAll: v })}
              />
            </Section>
          </>
        )}

        {state.styleTab === 'type' && (
          <>
            <Section label="Typeface">
              <div className="flex flex-col gap-1">
                {FONTS.map((font) => (
                  <button
                    key={font.name}
                    type="button"
                    onClick={() => patch({ font: font.name }, true)}
                    className={cn(
                      'flex items-center justify-between rounded-[10px] border px-3 py-2 transition-colors',
                      state.font === font.name
                        ? 'border-[var(--ord-acid)] bg-[var(--ord-acid)]/12'
                        : 'border-[var(--border-hairline)] bg-[var(--ord-paper)]/5'
                    )}
                  >
                    <span
                      className="ord-type-label text-[var(--ord-paper)]"
                      style={{ fontFamily: font.family }}
                    >
                      {font.name}
                    </span>
                    <span className="ord-mono">{font.label}</span>
                  </button>
                ))}
              </div>
            </Section>

            <Section label="Size and spacing">
              <SliderField
                label="Font size"
                value={state.fontSize}
                readout={`${state.fontSize}`}
                min={24}
                max={120}
                onChange={(v) => patch({ fontSize: v })}
              />
              <SliderField
                label="Character spacing"
                value={state.charSpacing}
                readout={`${state.charSpacing.toFixed(2)}em`}
                min={-0.05}
                max={0.3}
                step={0.01}
                onChange={(v) => patch({ charSpacing: v })}
              />
              <ToggleField
                label="Auto fit"
                hint="Ordio sizes each line to the canvas"
                checked={state.autoFit}
                onChange={(v) => patch({ autoFit: v })}
              />
            </Section>

            <Section label="Capitalisation">
              <ChipRow
                options={[
                  { id: 'none', label: 'As spoken' },
                  { id: 'uppercase', label: 'UPPER' },
                  { id: 'capitalize', label: 'Title' },
                ]}
                value={state.capCase}
                onChange={(id) => patch({ capCase: id }, true)}
              />
            </Section>
          </>
        )}

        {state.styleTab === 'colour' && (
          <>
            <Section label="Caption">
              <ColourField
                label="Caption text"
                value={state.textColor}
                onChange={(v) => patch({ textColor: v })}
              />
              <ColourField
                label="Active word"
                value={state.activeWordColor}
                onChange={(v) => patch({ activeWordColor: v })}
              />
              <ColourField
                label="Active word fill"
                value={state.activeWordBg}
                onChange={(v) => patch({ activeWordBg: v })}
              />
              <ToggleField
                label="Fill the active word"
                checked={state.activeBgOn}
                onChange={(v) => patch({ activeBgOn: v })}
              />
              <ColourField
                label="Emphasis"
                value={state.emphasisColor}
                onChange={(v) => patch({ emphasisColor: v })}
              />
            </Section>

            <Section label="Caption box">
              <ToggleField
                label="Box behind the text"
                checked={state.capBgOn}
                onChange={(v) => patch({ capBgOn: v })}
              />
              <ColourField
                label="Box colour"
                value={state.captionBg}
                onChange={(v) => patch({ captionBg: v })}
              />
            </Section>

            <Section label="Canvas" hint="Picking a colour drops the artwork">
              <ColourField
                label="Backdrop colour"
                value={state.bgColor}
                onChange={(v) => patch({ bgColor: v })}
              />
              <ColourField
                label="Waveform"
                value={state.waveColor}
                onChange={(v) => patch({ waveColor: v })}
              />
            </Section>
          </>
        )}

        {state.styleTab === 'layout' && (
          <>
            <Section label="Alignment">
              <ChipRow
                options={[
                  { id: 'start', label: 'Left' },
                  { id: 'center', label: 'Centre' },
                  { id: 'end', label: 'Right' },
                ]}
                value={state.align}
                onChange={(id) => patch({ align: id })}
              />
            </Section>

            <Section label="Vertical position">
              <ChipRow
                options={[
                  { id: 'auto', label: 'Auto' },
                  { id: 'top', label: 'Top' },
                  { id: 'middle', label: 'Middle' },
                  { id: 'bottom', label: 'Bottom' },
                ]}
                value={state.vAlign}
                onChange={(id) => patch({ vAlign: id })}
              />
            </Section>

            <Section label="Visual">
              <ChipRow
                options={VISUALS.map((v) => ({ id: v.id, label: v.label }))}
                value={state.visual}
                onChange={(id) => patch({ visual: id })}
              />
            </Section>
          </>
        )}
      </PanelBody>
    </>
  );
}
