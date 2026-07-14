'use client';

interface PromptBarProps {
  visible: boolean;
  placeholder: string;
}

export function PromptBar({ visible, placeholder }: PromptBarProps) {
  if (!visible) return null;
  return (
    <div className="absolute left-1/2 bottom-6.5 -translate-x-1/2 w-[min(560px,80%)]">
      <div className="flex items-center gap-3 h-14 pl-4.5 pr-2 bg-acid-surface-1 border border-acid-border-default rounded-acid-lg shadow-2xl">
        <span className="text-acid-text-1 text-lg">✦</span>
        <div className="flex-1 text-[15px] text-acid-text-2">{placeholder}</div>
        <button
          className="w-10 h-10 rounded-acid-sm bg-acid-text-1 text-acid-bg-base font-bold"
          aria-label="Submit prompt"
          disabled
        >
          ↑
        </button>
      </div>
    </div>
  );
}
