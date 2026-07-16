'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { getRecordingDraft, clearRecordingDraft } from '@/lib/persistence/recordingDraft';

/**
 * Checks once per mount for a leftover autosaved recording (from a crash
 * or closed tab) and offers the user a Resume/Discard choice via toast.
 */
export function useRecordingRecovery(onResume: (blob: Blob) => Promise<void>): void {
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    void (async () => {
      const draft = await getRecordingDraft();
      if (!draft) return;

      toast('Unsaved recording found', {
        description: 'We recovered a recording from your last session.',
        duration: Infinity,
        action: {
          label: 'Resume',
          onClick: () => {
            void onResume(draft.blob);
          },
        },
        cancel: {
          label: 'Discard',
          onClick: () => {
            void clearRecordingDraft();
          },
        },
      });
    })();
  }, [onResume]);
}
