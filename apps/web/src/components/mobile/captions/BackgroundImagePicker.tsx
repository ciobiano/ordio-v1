'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@Ordio/convex';
import type { GenericId } from 'convex/values';
import { toast } from 'sonner';
import { notifyError } from '@/lib/errors/notify';
import { OrdioError } from '@/lib/errors/OrdioError';
import { backgroundCodeFor } from '@/lib/errors/classify';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores';
import { useFeatureGates } from '@/hooks/auth/useFeatureGates';
import LockBadge from '@/components/ui/LockBadge';
import type { FeatureKey } from '@/lib/featureGates';
import { backgroundLabelForUpload } from '@/lib/backgroundLabel';

interface BackgroundImagePickerProps {
  onLocked?: (feature: FeatureKey) => void;
}

const TILE_CLASS =
  'relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border transition-colors duration-150';

// No transcode step (unlike video) — cap matches the server's stored-size ceiling directly.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Thumbnail strip for user-uploaded custom image backgrounds. No curated
 * library — every entry here is something the user uploaded themselves.
 * Static images only for now; animated GIF support is a deliberate fast-follow
 * (canvas-drawing an animated GIF reliably needs its own decode approach).
 */
export function BackgroundImagePicker({ onLocked }: BackgroundImagePickerProps) {
  const style = useUIStore((s) => s.style);
  const setStyle = useUIStore((s) => s.setStyle);
  const { isLocked } = useFeatureGates();
  const myImages = (useQuery(api.backgrounds.listMyBackgrounds) ?? []).filter(
    (asset) => asset.mediaType === 'image'
  );
  const generateUploadUrl = useMutation(api.jobs.generateUploadUrl);
  const uploadBackground = useMutation(api.backgrounds.uploadBackground);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const selected = style.background?.type === 'image' ? style.background : null;

  const selectImage = (assetId: string) => {
    if (selected?.assetId === assetId) {
      // Tap again to deselect — back to the solid color
      setStyle({ background: { type: 'solid', color: style.backgroundColor } });
      return;
    }
    setStyle({ background: { type: 'image', source: 'custom', assetId } });
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
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      notifyError(new OrdioError('BACKGROUND_UNSUPPORTED_FORMAT'));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      notifyError(new OrdioError('BACKGROUND_TOO_LARGE'));
      return;
    }

    setIsUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!res.ok) {
        throw new OrdioError('BACKGROUND_UPLOAD_FAILED', {
          message: `Background upload returned HTTP ${res.status}`,
        });
      }
      const { storageId } = (await res.json()) as { storageId: string };
      const assetId = await uploadBackground({
        storageId: storageId as GenericId<'_storage'>,
        // Not the raw filename: iOS hands over things like
        // `CFNetworkDownload_34hlmZ.tmp` for anything routed through the Files
        // app, which is not a name the user would recognise.
        label: backgroundLabelForUpload(file.name, myImages.length),
        mediaType: 'image',
        sizeBytes: file.size,
      });
      setStyle({ background: { type: 'image', source: 'custom', assetId } });
      toast.success('Background added');
    } catch (err) {
      // Never the raw message: the transcoder's wording is not written for people.
      notifyError(err, { fallback: backgroundCodeFor(err) });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="listbox"
        aria-label="Image backgrounds"
      >
        {myImages.map((asset) => {
          const isSelected = selected?.assetId === asset._id;
          return (
            <button
              key={asset._id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => selectImage(asset._id)}
              className={cn(
                TILE_CLASS,
                'bg-white/[0.06]',
                isSelected ? 'border-white/80' : 'border-white/15'
              )}
            >
              <span className="flex h-full items-center justify-center px-1 text-[10px] text-white/70 truncate">
                {asset.label ?? 'My image'}
              </span>
            </button>
          );
        })}

        <div className="relative shrink-0">
          <button
            type="button"
            disabled={isUploading}
            onClick={handleUploadClick}
            className={cn(
              TILE_CLASS,
              'border-dashed border-white/25 bg-transparent text-white/60',
              isUploading && 'opacity-40'
            )}
            aria-label="Upload a background image"
            aria-busy={isUploading}
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
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        className="sr-only"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
