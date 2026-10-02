import type { EnhanceTier } from '@/stores';
import type { ErrorCode } from '@/lib/errors/catalog';

const ENHANCE_URL = process.env.NEXT_PUBLIC_ENHANCE_URL ?? '';

export type EnhanceResult =
  | { ok: true; blob: Blob }
  | { ok: false; blob: Blob; error: string; code: ErrorCode };

function handleEnhanceError(error: string): void {
  console.error('[audio-enhance]', error);
}

export async function enhanceAudio(
  blob: Blob,
  tier: Exclude<EnhanceTier, 'none'>,
  onProgress?: (percent: number) => void,
): Promise<EnhanceResult> {
  if (!ENHANCE_URL) {
    handleEnhanceError('NEXT_PUBLIC_ENHANCE_URL is not configured.');
    return {
      ok: false,
      blob,
      error: 'Enhancement service URL is not configured.',
      code: 'ENHANCE_NOT_CONFIGURED',
    };
  }

  const timeout = tier === 'clean' ? 60_000 : 120_000;
  const url = `${ENHANCE_URL}/enhance/${tier}`;

  return new Promise<EnhanceResult>((resolve) => {
    const formData = new FormData();
    formData.append('file', blob);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event: ProgressEvent): void => {
      if (!onProgress || !event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 50));
    };

    xhr.onprogress = (event: ProgressEvent): void => {
      if (!onProgress || !event.lengthComputable) return;
      onProgress(Math.round(50 + (event.loaded / event.total) * 50));
    };

    xhr.onload = (): void => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true, blob: xhr.response as Blob });
        return;
      }
      const error = `Enhancement service returned HTTP ${xhr.status.toString()}.`;
      handleEnhanceError(error);
      resolve({ ok: false, blob, error, code: 'ENHANCE_SERVICE_ERROR' });
    };

    xhr.onerror = (): void => {
      const error = 'Network error contacting enhancement service.';
      handleEnhanceError(error);
      resolve({ ok: false, blob, error, code: 'ENHANCE_NETWORK' });
    };

    xhr.ontimeout = (): void => {
      const error = `Enhancement timed out after ${(timeout / 1000).toString()}s.`;
      handleEnhanceError(error);
      resolve({ ok: false, blob, error, code: 'ENHANCE_TIMEOUT' });
    };

    xhr.open('POST', url);
    xhr.responseType = 'blob';
    xhr.timeout = timeout;
    xhr.send(formData);
  });
}
