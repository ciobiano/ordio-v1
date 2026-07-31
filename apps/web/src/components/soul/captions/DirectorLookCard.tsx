'use client';

import { useEffect, useRef, useState } from 'react';
import { renderFrame } from '@Ordio/engine/video';
import { loadFont } from '@Ordio/engine/loaders';
import { loadPresetBackgroundImage } from '@Ordio/engine/loaders/backgroundLoader';
import { waveformSampler } from '@Ordio/shared/waveform';
import { FPS, timeToFrame } from '@Ordio/shared/time';
import { cn } from '@/lib/utils';
import { useProcessingStore, useCaptureStore, useUIStore } from '@/stores';
import type { DirectorLook } from '@/stores/directorStore';

const CARD_WIDTH = 160;

interface DirectorLookCardProps {
  look: DirectorLook;
  label: string;
  isSelected: boolean;
  onSelect: () => void;
}

/**
 * A real canvas render of a Director look — not a static thumbnail — drawn
 * at the hook phrase's moment so the boosted Hook Card scale is visible in
 * the same glance as the rest of the look.
 */
export function DirectorLookCard({ look, label, isSelected, onSelect }: DirectorLookCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transcript = useProcessingStore((s) => s.transcript);
  const captionGroups = useProcessingStore((s) => s.captionGroups);
  const audioBuffer = useCaptureStore((s) => s.audioBuffer);
  const sessionWaveformStyle = useUIStore((s) => s.waveformStyle);
  const canvasLayout = useUIStore((s) => s.canvasLayout);
  // Preview the visual the look will actually apply, not the session's current
  // one — otherwise the card misrepresents what tapping it does.
  const waveformStyle = look.waveformStyle ?? sessionWaveformStyle;
  const [fontLoaded, setFontLoaded] = useState(false);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    setFontLoaded(false);
    void loadFont(look.style.fontFamily).then(() => setFontLoaded(true));
  }, [look.style.fontFamily]);

  // Looks with a canvas-preset background carry their own artwork — renderFrame
  // only composites a backgroundFrame it's handed, it never resolves one itself.
  useEffect(() => {
    const background = look.style.background;
    if (background?.type !== 'image' || background.source !== 'preset') {
      setBgImage(null);
      return;
    }
    let cancelled = false;
    loadPresetBackgroundImage(background.assetId)
      .then((img) => {
        if (!cancelled) setBgImage(img);
      })
      .catch(() => {
        if (!cancelled) setBgImage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [look.style.background]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fontLoaded) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const aspectRatio = look.style.height / look.style.width;
    const previewStyle = {
      ...look.style,
      width: CARD_WIDTH,
      height: Math.round(CARD_WIDTH * aspectRatio),
    };
    canvas.width = previewStyle.width;
    canvas.height = previewStyle.height;

    const waveformData = audioBuffer ? waveformSampler(audioBuffer, 200) : [];
    const previewTime = captionGroups[look.hookGroupIndex]?.start ?? 0;
    const totalFrames = Math.max(1, Math.ceil((audioBuffer?.duration ?? 1) * FPS));

    renderFrame(ctx, timeToFrame(previewTime), totalFrames, {
      waveformData,
      transcript,
      style: previewStyle,
      waveformStyle,
      canvasLayout,
      captionGroups,
      backgroundFrame: bgImage ?? undefined,
    });
  }, [look, fontLoaded, bgImage, transcript, captionGroups, audioBuffer, waveformStyle, canvasLayout]);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={`Apply the "${label}" look`}
      className={cn(
        'relative shrink-0 overflow-hidden rounded-2xl border-2 transition-colors duration-150',
        isSelected ? 'border-white' : 'border-white/15 hover:border-white/40'
      )}
    >
      <canvas ref={canvasRef} className="block h-auto w-40" />
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-xs text-white">
        {label}
      </span>
    </button>
  );
}
