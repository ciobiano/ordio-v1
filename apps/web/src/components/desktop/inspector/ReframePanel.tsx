'use client';

/** Ratio, fit, and the safe zone you post into. */

import { HugeiconsIcon } from '@hugeicons/react';
import {
  FullScreenIcon,
  SquareArrowExpand01Icon,
  MagicWand01Icon,
} from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import type { StyleConfig } from '@Ordio/shared/schemas';
import type { DeskState } from '@/lib/desktop/deskState';
import { FORMATS, SAFE, type SafeId } from '@/lib/desktop/deskCatalog';
import { ChipRow, PanelBody, Section } from './InspectorFields';

type ContentFit = NonNullable<StyleConfig['contentFit']>;

/**
 * The three fits, matching the phone's Reframe sheet.
 *
 * The desk offered two unlabelled text chips and was missing `auto`
 * altogether, so there was a composition the phone can express and the desk
 * could not. The icons come with them because "Fill" and "Fit" name a
 * difference that is far easier to recognise as a shape than to read as a
 * word — which is the whole reason the phone draws them.
 */
const FITS: { value: ContentFit; label: string; icon: typeof FullScreenIcon; hint: string }[] = [
  { value: 'fill', label: 'Fill', icon: FullScreenIcon, hint: 'Crop to cover the frame' },
  { value: 'fit', label: 'Fit', icon: SquareArrowExpand01Icon, hint: 'Show all of it, letterboxed' },
  { value: 'auto', label: 'Auto', icon: MagicWand01Icon, hint: 'Crop when the shapes are close' },
];

interface ReframePanelProps {
  state: DeskState;
  patch: (patch: Partial<DeskState>) => void;
}

export function ReframePanel({ state, patch }: ReframePanelProps) {
  return (
    <PanelBody>
      <Section label="Aspect ratio">
        <div className="flex gap-2">
          {FORMATS.map((format) => (
            <button
              key={format.id}
              type="button"
              onClick={() => patch({ format: format.id })}
              aria-pressed={state.format === format.id}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border py-2 transition-colors duration-[var(--dur-tap)]',
                state.format === format.id
                  ? 'border-[var(--ord-acid)] bg-[var(--ord-acid)]/12'
                  : 'border-[var(--border-hairline)] bg-[var(--ord-paper)]/5'
              )}
            >
              {/* Outlined, so the glyph reads as a frame you compose into
                  rather than a filled block sitting in one. */}
              <span
                className="block rounded-[3px] border border-[var(--text-body)]"
                style={{ width: format.w, height: format.h }}
              />
              <span className="ord-mono">{format.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section label="Content fit" hint="Applies to photo and video backdrops.">
        <div className="flex gap-2">
          {FITS.map((fit) => (
            <button
              key={fit.value}
              type="button"
              onClick={() => patch({ fit: fit.value })}
              aria-pressed={state.fit === fit.value}
              title={fit.hint}
              className={cn(
                'flex flex-1 flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 transition-colors duration-[var(--dur-tap)]',
                state.fit === fit.value
                  ? 'border-[var(--ord-acid)] bg-[var(--ord-acid)]/12 text-[var(--ord-paper)]'
                  : 'border-[var(--border-hairline)] bg-[var(--ord-paper)]/5 text-[var(--text-muted)]'
              )}
            >
              <HugeiconsIcon icon={fit.icon} size={17} strokeWidth={2} />
              <span className="ord-type-footnote font-semibold">{fit.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section label="Safe zones">
        <ChipRow
          options={(Object.keys(SAFE) as SafeId[]).map((id) => ({
            id,
            label: SAFE[id].label,
          }))}
          value={state.safe}
          onChange={(id) => patch({ safe: id, safeShow: id !== 'none' })}
        />
      </Section>
    </PanelBody>
  );
}
