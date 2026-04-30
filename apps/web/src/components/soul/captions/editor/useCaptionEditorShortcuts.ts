'use client';

import { useEffect } from 'react';

type UseCaptionEditorShortcutsProps = {
  clearSelection: () => void;
  undoCaptions: () => void;
  redoCaptions: () => void;
};

export function useCaptionEditorShortcuts({
  clearSelection,
  undoCaptions,
  redoCaptions,
}: UseCaptionEditorShortcutsProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tagName = (event.target as HTMLElement)?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea') return;

      if (event.key === 'Escape') {
        clearSelection();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoCaptions();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && (event.key === 'y' || (event.shiftKey && event.key === 'z'))) {
        event.preventDefault();
        redoCaptions();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearSelection, redoCaptions, undoCaptions]);
}

