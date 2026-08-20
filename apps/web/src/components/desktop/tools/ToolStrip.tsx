'use client';

/**
 * The floating tool strip.
 *
 * A vertical column of icons pinned to the right edge of the stage, floating
 * over the canvas rather than docked beside it. Clicking an icon opens its
 * panel; clicking the same icon closes it. That is one control doing one job —
 * the docked rail needed a second gesture on a second control to dismiss a
 * panel, and had no state at all where the canvas simply got the room.
 *
 * Cost at rest is the 48px strip. The old rail plus inspector reserved 444px
 * whether or not anything was open.
 *
 * Icons carry no labels, so every button carries its title and its hint as a
 * tooltip and the open panel restates the name in full.
 */

import { useCallback, useRef } from 'react';
import { deskToolButton } from '@/lib/variants';
import { TOOL_COPY, type ToolId } from '@/lib/desktop/deskCatalog';
import {
  AudioGlyph,
  DirectorGlyph,
  PresetsGlyph,
  ReframeGlyph,
  StyleGlyph,
  TimingGlyph,
  TrimGlyph,
} from '../DeskIcons';

const TOOLS: { id: ToolId; Glyph: typeof StyleGlyph }[] = [
  { id: 'presets', Glyph: PresetsGlyph },
  { id: 'style', Glyph: StyleGlyph },
  { id: 'timing', Glyph: TimingGlyph },
  { id: 'audio', Glyph: AudioGlyph },
  { id: 'trim', Glyph: TrimGlyph },
  { id: 'reframe', Glyph: ReframeGlyph },
  { id: 'director', Glyph: DirectorGlyph },
];

interface ToolStripProps {
  tool: ToolId;
  open: boolean;
  disabled: boolean;
  onToggle: (tool: ToolId) => void;
}

export function ToolStrip({ tool, open, disabled, onToggle }: ToolStripProps) {
  const stripRef = useRef<HTMLDivElement>(null);

  /* Up and down walk the strip, because the strip is vertical. Roving focus
     rather than a tab stop per button: seven icons should be one stop. */
  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const buttons = Array.from(
      stripRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []
    );
    if (buttons.length === 0) return;
    event.preventDefault();
    const here = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    buttons[(Math.max(here, 0) + step + buttons.length) % buttons.length].focus();
  }, []);

  return (
    <div
      ref={stripRef}
      role="toolbar"
      aria-orientation="vertical"
      aria-label="Editor tools"
      className="ord-toolstrip"
      onKeyDown={onKeyDown}
    >
      {TOOLS.map(({ id, Glyph }) => {
        const isOpen = open && tool === id;
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            aria-expanded={isOpen}
            aria-label={TOOL_COPY[id].title}
            title={`${TOOL_COPY[id].title} — ${TOOL_COPY[id].hint}`}
            onClick={() => onToggle(id)}
            className={deskToolButton({ open: isOpen })}
          >
            <Glyph size={18} />
          </button>
        );
      })}
    </div>
  );
}
