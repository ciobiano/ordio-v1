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
        className="w-full flex items-center gap-3 h-14 pl-4.5 pr-2 bg-acid-surface-1 border border-acid-border-subtle rounded-acid-lg shadow-[0_18px_50px_-18px_rgba(0,0,0,0.7)] cursor-pointer text-left hover:border-acid-border-default transition-colors"
      >
        <span className="text-acid-accent text-lg">✦</span>
        <span className="flex-1 text-[15px] text-acid-text-2">{placeholder}</span>
        <span
          aria-hidden="true"
          className="w-10 h-10 rounded-[14px] bg-acid-accent text-acid-on-accent font-black text-[17px] flex items-center justify-center"
        >
          ↑
        </span>
      </button>
    </div>
  );
}
