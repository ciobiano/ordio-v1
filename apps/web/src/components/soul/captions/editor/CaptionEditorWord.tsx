'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';

interface CaptionEditorWordProps {
  text: string;
  isEditing: boolean;
  isAccented: boolean;
  isCursorHere: boolean;
  /** Accent marking only applies to styles that honour it. */
  supportsAccent: boolean;
  onToggleAccent: () => void;
  onBeginEdit: () => void;
  onCommitEdit: (text: string) => void;
  onCancelEdit: () => void;
}

/**
 * One word in a selected caption row: tap to mark emphasis, double-tap to fix
 * the text.
 *
 * The two gestures deliberately overlap. A double-tap fires click twice before
 * dblclick, so the accent toggles on and straight back off — a no-op — and the
 * user lands in edit mode with nothing else changed. The alternative is delaying
 * every accent tap behind a double-tap window, which makes the common gesture
 * feel broken to save the rare one from a flicker.
 */
export function CaptionEditorWord({
  text,
  isEditing,
  isAccented,
  isCursorHere,
  supportsAccent,
  onToggleAccent,
  onBeginEdit,
  onCommitEdit,
  onCancelEdit,
}: CaptionEditorWordProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        defaultValue={text}
        autoFocus
        aria-label={`Edit "${text}"`}
        onClick={(event) => event.stopPropagation()}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={(event) => onCommitEdit(event.currentTarget.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter') {
            onCommitEdit(event.currentTarget.value);
          } else if (event.key === 'Escape') {
            // Cancel before blur can commit it.
            onCancelEdit();
          }
        }}
        // Sized to the content so the row doesn't reflow while typing.
        style={{ width: `${Math.max(3, text.length + 1)}ch` }}
        className={cn(
          'rounded-md border-2 px-1 py-0.5 text-sm outline-none',
          'border-[color:var(--acid-accent)] bg-[color:var(--acid-accent-soft)]',
          'text-[color:var(--acid-text-1)]'
        )}
      />
    );
  }

  if (!supportsAccent) {
    return (
      <button
        type="button"
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onBeginEdit();
        }}
        title="Double-tap to edit"
        className={cn(
          'cursor-text rounded-md px-0.5 text-sm',
          isCursorHere ? 'text-foreground' : 'text-foreground/80'
        )}
      >
        {text}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={isAccented}
      aria-label={`${isAccented ? 'Remove' : 'Mark'} emphasis on "${text}" — double-tap to edit`}
      title="Tap to emphasise, double-tap to edit"
      onClick={(event) => {
        event.stopPropagation();
        onToggleAccent();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onBeginEdit();
      }}
      className={cn(
        'cursor-text rounded-md px-0.5 text-sm transition-colors',
        isAccented
          ? 'bg-primary/20 text-primary'
          : isCursorHere
            ? 'text-foreground'
            : 'text-foreground/80'
      )}
    >
      {text}
    </button>
  );
}
