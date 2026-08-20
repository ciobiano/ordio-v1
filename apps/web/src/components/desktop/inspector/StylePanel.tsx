'use client';

/** Caption style — the design's largest panel, split across four tabs. */

import { HugeiconsIcon } from '@hugeicons/react';
import { Clock01Icon, DashboardSquare02Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { chip } from '@/lib/variants';
import type { DeskState, StyleTab } from '@/lib/desktop/deskState';
import type { BreakMode } from '@Ordio/engine/captions/breaks';
import { ANIMS, FONTS, VISUALS } from '@/lib/desktop/deskCatalog';
import { useDeskFonts } from '@/lib/desktop/useDeskFonts';
import {
  ChipRow,
  ColourField,
  FieldRow,
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

/**
 * Frequency and Quantity are one choice shown as two rows — the arrangement
 * mobile uses. `quantity` is deliberately absent from Frequency: picking a
 * count in the second row is what switches the mode, so the first row
 * deselects rather than the second row appearing out of nowhere.
 */
const BREAK_FREQUENCIES: { id: BreakMode; label: string }[] = [
  { id: 'punct', label: 'Punctuation or pause' },
  { id: 'single', label: 'Single word' },
  { id: 'time', label: 'Time' },
  { id: 'random', label: 'Random' },
];

const BREAK_QUANTITIES: { id: string; label: string }[] = [
  { id: '1', label: 'One' },
  { id: '2', label: 'Two' },
  { id: '3', label: 'Three' },
  { id: '4', label: 'Four' },
  { id: '5', label: 'Five' },
  { id: '6', label: 'Six' },
  { id: '7', label: 'Seven' },
  { id: '8', label: 'Eight' },
  { id: 'random', label: 'Random' },
];

interface StylePanelProps {
  state: DeskState;
  patch: (patch: Partial<DeskState>, undoable?: boolean) => void;
}

export function StylePanel({ state, patch }: StylePanelProps) {
  // The Typeface list sets fontFamily on every row; unloaded, they all render
  // in the same fallback and the list shows ten identical names.
  useDeskFonts(FONTS.map((f) => f.name));

  return (
    <>
      <div className="flex flex-none gap-1 px-4 pb-2">
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
            <Section label="Animation">
              <div className="flex flex-col gap-1">
                {ANIMS.map((anim) => (
                  <button
                    key={anim.id}
                    type="button"
                    onClick={() => patch({ anim: anim.id }, true)}
                    className={cn(
                      'flex flex-col gap-1 rounded-xl border px-3 py-2 text-left transition-colors duration-[var(--dur-tap)]',
                      state.anim === anim.id
                        ? 'border-[var(--ord-acid)] bg-[var(--ord-acid)]/12'
                        : 'border-[var(--border-hairline)] bg-[var(--ord-paper)]/5'
                    )}
                  >
                    <span className="ord-type-footnote font-semibold text-[var(--ord-paper)]">
                      {anim.label}
                    </span>
                    <span className="font-[family-name:var(--font-display)] ord-type-footnote text-[var(--text-muted)]">
                      {anim.hint}
                    </span>
                  </button>
                ))}
              </div>
            </Section>

            <Section
              label="Line breaks"
              hint="Where one caption ends and the next begins"
            >
              <FieldRow
                icon={<HugeiconsIcon icon={Clock01Icon} size={16} strokeWidth={2} />}
                label="Frequency"
              >
                <ChipRow
                  options={BREAK_FREQUENCIES}
                  value={state.breakMode === 'quantity' ? null : state.breakMode}
                  onChange={(id) => patch({ breakMode: id })}
                />
              </FieldRow>

              <FieldRow
                icon={
                  <HugeiconsIcon
                    icon={DashboardSquare02Icon}
                    size={16}
                    strokeWidth={2}
                  />
                }
                label="Quantity"
              >
                {/* Always present, never conditional. Hiding this until the
                    mode was already `quantity` meant the only way to find it
                    was to pick the option it belonged to — undiscoverable.
                    Choosing a count here sets the mode. */}
                <ChipRow
                  options={BREAK_QUANTITIES}
                  value={
                    state.breakMode === 'quantity' ? String(state.breakQty) : null
                  }
                  onChange={(id) =>
                    patch({
                      breakMode: 'quantity',
                      breakQty: id === 'random' ? 'random' : Number(id),
                    })
                  }
                />
              </FieldRow>

              {state.breakMode === 'time' && (
                <SliderField
                  label="Hold each caption"
                  value={state.breakSecs}
                  readout={`${state.breakSecs.toFixed(1)}s`}
                  min={1}
                  max={6}
                  step={0.5}
                  minLabel="Snappy"
                  maxLabel="Slow"
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
                      'flex items-center justify-between rounded-xl border px-3 py-2 transition-colors duration-[var(--dur-tap)]',
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
                minLabel="Small"
                maxLabel="Large"
                onChange={(v) => patch({ fontSize: v })}
              />
              {/* Line spacing was missing entirely — the stage had 1.15
                  hardcoded, so multi-line captions could not be tightened or
                  opened up at all. Mobile has had this since LayoutTab; the
                  range matches, and the value is a raw line-height so it
                  means the same thing in both places. */}
              <SliderField
                label="Line spacing"
                value={state.lineHeight}
                readout={state.lineHeight.toFixed(2)}
                min={0.8}
                max={2.4}
                step={0.01}
                minLabel="Tight"
                maxLabel="Loose"
                onChange={(v) => patch({ lineHeight: v })}
              />
              <SliderField
                label="Character spacing"
                value={state.charSpacing}
                readout={`${state.charSpacing.toFixed(2)}em`}
                min={-0.05}
                max={0.3}
                step={0.01}
                minLabel="Tighter"
                maxLabel="Wider"
                onChange={(v) => patch({ charSpacing: v })}
              />
              <ToggleField
                label="Auto fit"
                hint="Ordio sizes each line to the canvas"
                checked={state.autoFit}
                onChange={(v) => patch({ autoFit: v })}
              />
            </Section>

            {/* Stroke was reachable only by picking a preset that happened to
                set it: Street applies a 3px stroke and nothing could change or
                clear it afterwards. Glow was worse — a state field nothing
                wrote and nothing drew, so it is wired to the stage here rather
                than given a slider that does nothing. */}
            <Section label="Edge">
              <SliderField
                label="Stroke width"
                value={state.strokeW}
                readout={`${state.strokeW}px`}
                min={0}
                max={8}
                step={0.5}
                minLabel="None"
                maxLabel="Heavy"
                onChange={(v) => patch({ strokeW: v })}
              />
              <SliderField
                label="Glow"
                value={state.glow}
                readout={`${Math.round(state.glow * 100)}%`}
                min={0}
                max={1}
                step={0.05}
                minLabel="Off"
                maxLabel="Strong"
                onChange={(v) => patch({ glow: v })}
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
