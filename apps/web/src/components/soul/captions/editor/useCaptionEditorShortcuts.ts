'use client';

import { useEffect } from 'react';

type UseCaptionEditorShortcutsProps = {
  clearSelection: () => void;
};

/**
 * Escape clears the caption selection.
 *
 * Undo/redo used to live here too. They moved to `useExportShortcuts`, which
 * sits with the transport bar that owns the unified history — binding them in
 * two places would have given the caption panel a second, narrower undo.
 */
export function useCaptionEditorShortcuts({ clearSelection }: UseCaptionEditorShortcutsProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tagName = (event.target as HTMLElement)?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea') return;

      if (event.key === 'Escape') clearSelection();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearSelection]);
}
