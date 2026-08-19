/**
 * Editor glyphs, transcribed verbatim from the design's inline SVG.
 *
 * The house set is HugeIcons, but the design draws its own 24px stroked paths
 * and the rail reads as a set — swapping in near-matches from a library made
 * the six tools look like six unrelated icons. These stay local and exact.
 */

interface GlyphProps {
  size?: number;
  className?: string;
}

type SvgProps = GlyphProps & { children?: React.ReactNode };

function Svg({ size = 18, className, children }: SvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const SearchGlyph = (p: GlyphProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);

export const KeyboardGlyph = (p: GlyphProps) => (
  <Svg {...p}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
  </Svg>
);

export const UndoGlyph = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Svg>
);

export const RedoGlyph = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </Svg>
);

export const PlayGlyph = ({ size = 15, className }: GlyphProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M6 3v18l14-9z" />
  </svg>
);

export const PauseGlyph = ({ size = 15, className }: GlyphProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <rect x="14" y="4" width="4" height="16" rx="1" />
    <rect x="6" y="4" width="4" height="16" rx="1" />
  </svg>
);

export const MinusGlyph = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);

export const PlusGlyph = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </Svg>
);

/* ─── Rail tools ─── */

export const StyleGlyph = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h10M4 17h6" />
  </Svg>
);

export const TimingGlyph = (p: GlyphProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);

export const AudioGlyph = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M4 10v4M8 6v12M12 9v6M16 4v16M20 10v4" />
  </Svg>
);

export const TrimGlyph = (p: GlyphProps) => (
  <Svg {...p}>
    <circle cx="6" cy="18" r="2.5" />
    <circle cx="18" cy="18" r="2.5" />
    <path d="M8 16 18 4M16 16 6 4" />
  </Svg>
);

export const ReframeGlyph = (p: GlyphProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M8 5v14M16 5v14" />
  </Svg>
);

export const DirectorGlyph = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="m12 3 2.2 5.4 5.8.4-4.4 3.8 1.4 5.7L12 15.3 7 18.3l1.4-5.7L4 8.8l5.8-.4z" />
  </Svg>
);

/* ─── Media ─── */

export const MicGlyph = (p: GlyphProps) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Svg>
);

export const UploadGlyph = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M12 16V4M8 8l4-4 4 4" />
    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Svg>
);

export const ClipGlyph = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M5 8v8M9 5v14M13 8v8M17 10v4M21 7v10" />
  </Svg>
);
