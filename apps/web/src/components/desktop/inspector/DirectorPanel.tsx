'use client';

/**
 * Director: three looks built from this clip.
 *
 * The desk's version was three hardcoded entries pointing at caption presets
 * that existed nowhere else in the product, and a "Reroll the three" button
 * that re-picked from the same static array of three. It named a feature the
 * phone has and delivered none of it.
 *
 * This is the real one: `useDirectorStore` posts the transcript to
 * `/api/direct` and resolves the returned looks into full StyleConfigs, and
 * each card is an actual `renderFrame` of that look drawn at the hook phrase —
 * not a swatch approximating one.
 *
 * Applying is two steps rather than one. `applyLook` writes the shared style,
 * which is what the canvas reads; but the desk republishes its own state into
 * that same store on every edit, so the look also has to land in desk state or
 * the next slider move would silently undo it.
 */

import { useEffect } from 'react';
import { LOOK_PRESETS } from '@Ordio/engine';
import { chip } from '@/lib/variants';
import { useDirectorStore, useUIStore } from '@/stores';
import { DirectorLookCard } from '@/components/mobile/captions/DirectorLookCard';
import type { DeskState } from '@/lib/desktop/deskState';
import { deskStateFromStyle } from '@/lib/desktop/deskStyleConfig';
import { PanelBody, Section } from './InspectorFields';

interface DirectorPanelProps {
  state: DeskState;
  patch: (patch: Partial<DeskState>, undoable?: boolean) => void;
}

export function DirectorPanel({ state, patch }: DirectorPanelProps) {
  const { looks, isGenerating, error, generateLooks, reroll, applyLook } = useDirectorStore();

  /* Generated on first open rather than on mount, so a panel nobody opens
     never spends a request. */
  useEffect(() => {
    if (!looks && !isGenerating && !error) void generateLooks();
  }, [looks, isGenerating, error, generateLooks]);

  const handleSelect = (index: number) => {
    applyLook(index);
    /* Read the style back out rather than from the look, because applyLook
       merges onto the session's current style — taking the look's own would
       drop everything it did not override. Undoable: a whole look landing at
       once is exactly what someone wants one keystroke back from. */
    patch(
      { ...deskStateFromStyle(useUIStore.getState().style), preset: looks?.[index]?.presetId ?? '' },
      true
    );

    const visual = useUIStore.getState().waveformStyle;
    if (visual !== state.visual) patch({ visual });
  };

  return (
    <PanelBody>
      <Section
        label="Looks"
        hint={
          error
            ? 'Director could not read this clip. Try again.'
            : 'Built from what you actually said — each card is a real frame.'
        }
      >
        {isGenerating && !looks ? (
          <p className="ord-type-footnote text-[var(--text-muted)]">Reading your clip…</p>
        ) : looks && looks.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {looks.map((look, index) => (
              <DirectorLookCard
                key={`${look.presetId}-${index}`}
                look={look}
                label={LOOK_PRESETS[look.presetId].label}
                isSelected={state.preset === look.presetId}
                onSelect={() => handleSelect(index)}
              />
            ))}
          </div>
        ) : (
          <p className="ord-type-footnote text-[var(--text-muted)]">
            {error ?? 'No looks yet.'}
          </p>
        )}
      </Section>

      <Section label="Not feeling it">
        <button
          type="button"
          onClick={() => void reroll()}
          disabled={isGenerating}
          className={chip({ size: 'md' })}
        >
          {isGenerating ? 'Thinking…' : 'Reroll the three'}
        </button>
      </Section>
    </PanelBody>
  );
}
