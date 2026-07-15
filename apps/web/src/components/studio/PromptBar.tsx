'use client';

interface PromptBarProps {
  visible: boolean;
  placeholder: string;
  /** The prompt bar and ⌘K are the same input summoned two ways — clicking it opens the palette. */
  onOpen: () => void;
}

export function PromptBar({ visible, placeholder, onOpen }: PromptBarProps) {
  if (!visible) return null;
  return (
    <div className="absolute left-1/2 bottom-6.5 -translate-x-1/2 w-[min(560px,80%)]">
      <button
        type="button"
        onClick={onOpen}
        aria-label="Search actions, ask copilot"
        className="w-full flex items-center gap-3 h-14 pl-4.5 pr-2 bg-acid-surface-1 border border-acid-border-default rounded-acid-lg shadow-2xl cursor-pointer text-left hover:border-acid-border-strong transition-colors"
      >
        <span className="text-acid-text-1 text-lg">✦</span>
        <span className="flex-1 text-[15px] text-acid-text-2">{placeholder}</span>
        <span
          aria-hidden="true"
          className="w-10 h-10 rounded-acid-sm bg-acid-text-1 text-acid-bg-base font-bold flex items-center justify-center"
        >
          ↑
        </span>
      </button>
    </div>
  );
}
