'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@Ordio/convex';
import type { GenericId } from 'convex/values';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores';
import { BACKGROUND_LIBRARY } from '@Ordio/engine/backgrounds/backgroundLibrary';
import { transcodeBackgroundUpload } from '@Ordio/engine/media/transcodeBackgroundUpload';
import { hasWebCodecsSupport } from '@Ordio/engine/video';
import { useFeatureGates } from '@/hooks/auth/useFeatureGates';
import LockBadge from '@/components/ui/LockBadge';
import type { FeatureKey } from '@/lib/featureGates';

interface BackgroundVideoPickerProps {
  onLocked?: (feature: FeatureKey) => void;
}

const TILE_CLASS =
  'relative h-14 w-24 shrink-0 overflow-hidden rounded-xl border transition-colors duration-150';

/**
 * Thumbnail strip for video backgrounds: curated loops, the user's custom
 * uploads, and an upload tile. Curated loops preview free (desire-driver);
 * export and uploads are creator-gated.
 */
export function BackgroundVideoPicker({ onLocked }: BackgroundVideoPickerProps) {
  const style = useUIStore((s) => s.style);
  const setStyle = useUIStore((s) => s.setStyle);
  const { isLocked } = useFeatureGates();
  const myBackgrounds = useQuery(api.backgrounds.listMyBackgrounds) ?? [];
  const generateUploadUrl = useMutation(api.jobs.generateUploadUrl);
  const uploadBackground = useMutation(api.backgrounds.uploadBackground);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const webCodecsOk = hasWebCodecsSupport();
  const selected = style.background?.type === 'video' ? style.background : null;

  const selectVideo = (source: 'curated' | 'custom', assetId: string) => {
    if (!webCodecsOk) return;
    if (selected?.source === source && selected.assetId === assetId) {
      // Tap again to deselect — back to the solid color
      setStyle({ background: { type: 'solid', color: style.backgroundColor } });
      return;
    }
    setStyle({ background: { type: 'video', source, assetId } });
  };

  const handleUploadClick = () => {
    if (isLocked('background_upload')) {
      onLocked?.('background_upload');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || isUploading) return;
    setIsUploading(true);
    try {
      const { blob, durationSec } = await transcodeBackgroundUpload(file);
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'video/mp4' },
        body: blob,
      });
      if (!res.ok) throw new Error('Upload failed');
      const { storageId } = (await res.json()) as { storageId: string };
      const assetId = await uploadBackground({
        storageId: storageId as GenericId<'_storage'>,
        label: file.name.replace(/\.[^.]+$/, ''),
        durationSec,
        sizeBytes: blob.size,
      });
      setStyle({ background: { type: 'video', source: 'custom', assetId } });
      toast.success('Background added');
    } catch (err) {
      console.error('[BackgroundVideoPicker]', err);
      toast.error(err instanceof Error ? err.message : 'Could not add this background');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">Background video</span>
        {!webCodecsOk && (
          <span className="text-[10px] text-white/40">Not supported on this browser</span>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="listbox" aria-label="Video backgrounds">
        {BACKGROUND_LIBRARY.map((asset) => {
          const isSelected = selected?.source === 'curated' && selected.assetId === asset.id;
          return (
            <button
              key={asset.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              disabled={!webCodecsOk}
              onClick={() => selectVideo('curated', asset.id)}
              className={cn(
                TILE_CLASS,
                isSelected ? 'border-white/80' : 'border-white/15',
                !webCodecsOk && 'opacity-40'
              )}
            >
              <Image
                src={asset.thumbPath}
                alt={asset.label}
                fill
                sizes="96px"
                className="object-cover"
              />
              <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[9px] text-white/80 truncate">
                {asset.label}
              </span>
            </button>
          );
        })}
        {myBackgrounds.map((asset) => {
          const isSelected = selected?.source === 'custom' && selected.assetId === asset._id;
          return (
            <button
              key={asset._id}
              type="button"
              role="option"
              aria-selected={isSelected}
              disabled={!webCodecsOk}
              onClick={() => selectVideo('custom', asset._id)}
              className={cn(
                TILE_CLASS,
                'bg-white/[0.06]',
                isSelected ? 'border-white/80' : 'border-white/15',
                !webCodecsOk && 'opacity-40'
              )}
            >
              <span className="flex h-full items-center justify-center px-1 text-[10px] text-white/70 truncate">
                {asset.label ?? 'My background'}
              </span>
            </button>
          );
        })}
        <div className="relative shrink-0">
          <button
            type="button"
            disabled={!webCodecsOk || isUploading}
            onClick={handleUploadClick}
            className={cn(
              TILE_CLASS,
              'border-dashed border-white/25 bg-transparent text-white/60',
              (!webCodecsOk || isUploading) && 'opacity-40'
            )}
            aria-label="Upload a background video"
          >
            <span className="flex h-full items-center justify-center text-lg">
              {isUploading ? '…' : '+'}
            </span>
          </button>
          {isLocked('background_upload') && (
            <LockBadge
              onClick={() => onLocked?.('background_upload')}
              label="Custom backgrounds require Creator"
            />
          )}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="sr-only"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
