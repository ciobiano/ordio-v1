'use client';

/**
 * The far-right tool column.
 *
 * Seven tools. Media moved out to the morphing left column, so picking a clip
 * and editing it are no longer on opposite sides of the screen; Presets moved
 * in from inside the Style panel, because a preset writes across every Style
 * tab and is where imported artwork will land.
 * See memory/project_desk_left_panel_morphs.md.
 */

import { railButton } from '@/lib/variants';
import { TOOL_COPY, type ToolId } from '@/lib/desktop/deskCatalog';
import {
  AudioGlyph,
  PresetsGlyph,
  DirectorGlyph,
  ReframeGlyph,
  StyleGlyph,
  TimingGlyph,
  TrimGlyph,
} from './DeskIcons';

const TOOLS: { id: ToolId; label: string; Glyph: typeof StyleGlyph }[] = [
  { id: 'presets', label: 'Presets', Glyph: PresetsGlyph },
  { id: 'style', label: 'Style', Glyph: StyleGlyph },
  { id: 'timing', label: 'Timing', Glyph: TimingGlyph },
  { id: 'audio', label: 'Audio', Glyph: AudioGlyph },
  { id: 'trim', label: 'Trim', Glyph: TrimGlyph },
  { id: 'reframe', label: 'Reframe', Glyph: ReframeGlyph },
  { id: 'director', label: 'Director', Glyph: DirectorGlyph },
];

interface ToolRailProps {
  tool: ToolId;
  onSelect: (tool: ToolId) => void;
  disabled: boolean;
}

export function ToolRail({ tool, onSelect, disabled }: ToolRailProps) {
  return (
    <nav className="ord-rail" aria-label="Editor tools">
      {TOOLS.map(({ id, label, Glyph }) => (
        <button
          key={id}
          type="button"
          disabled={disabled}
          aria-pressed={tool === id}
          title={TOOL_COPY[id].hint}
          onClick={() => onSelect(id)}
          className={railButton({ selected: tool === id })}
        >
          <Glyph size={18} />
          <span className="ord-type-caps">
            {label}
          </span>
        </button>
      ))}
    </nav>
  );
}
