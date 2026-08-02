'use client';

import { useState } from 'react';
import { useUIStore } from '@/stores';
import type { FeatureKey } from '@/lib/featureGates';
import { CanvasPresetPicker } from '../../CanvasPresetPicker';
import { BackgroundVideoPicker } from '../../BackgroundVideoPicker';
import { BackgroundImagePicker } from '../../BackgroundImagePicker';
import { SegmentedRow } from '../primitives/SegmentedRow';

type BackdropSource = 'preset' | 'video' | 'image';

const BACKDROP_OPTIONS = [
  { value: 'preset', label: 'Artwork' },
  { value: 'video', label: 'Video' },
  { value: 'image', label: 'Image' },
] as const satisfies readonly { value: BackdropSource; label: string }[];

interface TemplatesTabProps {
  onLocked?: (feature: FeatureKey) => void;
}

/**
 * Backdrop source + the matching picker. Promoted out of the Colors tab, where
 * it used to sit below four colour rows — the redesign gives it its own tab
 * because it is the highest-leverage control on the screen and was buried.
 *
 * `source` is local, not store state, on purpose: switching tabs browses without
 * changing the canvas. Only tapping a tile commits. Seeded from the applied
 * background so it opens on the right tab rather than always on Artwork.
 */
export function TemplatesTab({ onLocked }: TemplatesTabProps) {
  const background = useUIStore((s) => s.style.background);

  const [source, setSource] = useState<BackdropSource>(() =>
    background?.type === 'video' ? 'video' : background?.type === 'image' ? 'image' : 'preset'
  );

  return (
    <div className="flex flex-col gap-3">
      <SegmentedRow
        options={BACKDROP_OPTIONS}
        value={source}
        onChange={setSource}
        size="sm"
        ariaLabel="Backdrop source"
      />

      {source === 'preset' && <CanvasPresetPicker />}
      {source === 'video' && <BackgroundVideoPicker onLocked={onLocked} />}
      {source === 'image' && <BackgroundImagePicker onLocked={onLocked} />}
    </div>
  );
}
