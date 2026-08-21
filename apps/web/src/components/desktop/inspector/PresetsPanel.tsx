'use client';

/**
 * The backdrop: curated artwork, a video, or a photo.
 *
 * The desk previously called this "Presets" and offered six invented caption
 * looks — Hype, Clean, Street — that existed nowhere else in the product. The
 * phone's presets are backdrops, and they are what the renderer actually
 * composes against. Two different features wearing the same name, of which
 * only one could reach a frame.
 *
 * The three pickers are the phone's own components rather than desk copies of
 * them. They write `useUIStore.style` directly, which is the same store the
 * desk now publishes into and the canvas reads from — see `useDeskStyleSync`.
 */

import { useEffect } from 'react';
import { useState } from 'react';
import { useUIStore } from '@/stores';
import type { FeatureKey } from '@/lib/featureGates';
import type { DeskState } from '@/lib/desktop/deskState';
import { CanvasPresetPicker } from '@/components/mobile/captions/CanvasPresetPicker';
import { BackgroundVideoPicker } from '@/components/mobile/captions/BackgroundVideoPicker';
import { BackgroundImagePicker } from '@/components/mobile/captions/BackgroundImagePicker';
import { ChipRow, PanelBody, Section } from './InspectorFields';

type BackdropSource = 'preset' | 'video' | 'image';

const SOURCES: { id: BackdropSource; label: string }[] = [
  { id: 'preset', label: 'Artwork' },
  { id: 'video', label: 'Video' },
  { id: 'image', label: 'Image' },
];

interface PresetsPanelProps {
  state: DeskState;
  patch: (patch: Partial<DeskState>, undoable?: boolean) => void;
  onLocked?: (feature: FeatureKey) => void;
}

export function PresetsPanel({ state, patch, onLocked }: PresetsPanelProps) {
  const background = useUIStore((s) => s.style.background);
  const accentColor = useUIStore((s) => s.style.accentColor);

  /* Seeded from what is applied, so the panel opens on the tab that matches
     the canvas rather than always on Artwork. Local, not desk state: switching
     tabs browses, only picking a tile commits. */
  const [source, setSource] = useState<BackdropSource>(() =>
    background?.type === 'video' ? 'video' : background?.type === 'image' ? 'image' : 'preset'
  );

  /**
   * Take the accent a preset brings with it back into desk state.
   *
   * Artwork ships paired with an accent colour, and the picker writes both to
   * the store. The desk publishes `emphasisColor` into that same field on
   * every edit, so without this the paired accent would survive exactly until
   * the next slider moved and then be silently overwritten by the desk's own.
   */
  useEffect(() => {
    if (accentColor && accentColor !== state.emphasisColor) {
      patch({ emphasisColor: accentColor });
    }
    // Only a change arriving from the store should reconcile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accentColor]);

  return (
    <PanelBody>
      <Section label="Backdrop">
        <ChipRow
          options={SOURCES.map(({ id, label }) => ({ id, label }))}
          value={source}
          onChange={(id) => setSource(id)}
        />
      </Section>

      <Section
        label={
          source === 'preset' ? 'Artwork' : source === 'video' ? 'Video' : 'Photo'
        }
      >
        {source === 'preset' && <CanvasPresetPicker />}
        {source === 'video' && <BackgroundVideoPicker onLocked={onLocked} />}
        {source === 'image' && <BackgroundImagePicker onLocked={onLocked} />}
      </Section>
    </PanelBody>
  );
}
