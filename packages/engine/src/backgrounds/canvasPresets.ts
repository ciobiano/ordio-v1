/**
 * Curated canvas-preset manifest — 20 flat geometric artworks sourced from
 * Ordio's "Canvas Presets" design system (Figma community shapes file,
 * materialized to static SVG). Mirrors backgroundLibrary.ts's shape:
 * expanding the set is purely adding a file under public/ and an entry here.
 *
 * Unlike curated videos, these never need a signed URL or Convex round trip
 * — they ship with the app, so the loader can fetch the path directly.
 */

export interface CanvasPreset {
  id: string;
  label: string;
  imagePath: string;
  /** The artwork's own flat background color — pull UI accents from this per-preset rather than defaulting to one global accent. */
  accentColor: string;
}

export const CANVAS_PRESETS: CanvasPreset[] = [
  { id: 'bow', label: 'Bow', imagePath: '/backgrounds/canvas-presets/bow.svg', accentColor: 'rgb(241,245,143)' },
  { id: 'dwell', label: 'Dwell', imagePath: '/backgrounds/canvas-presets/dwell.svg', accentColor: 'rgb(249,94,71)' },
  { id: 'foundation', label: 'Foundation', imagePath: '/backgrounds/canvas-presets/foundation.svg', accentColor: 'rgb(178,103,150)' },
  { id: 'generation', label: 'Generation', imagePath: '/backgrounds/canvas-presets/generation.svg', accentColor: 'rgb(32,161,143)' },
  { id: 'inner', label: 'Inner', imagePath: '/backgrounds/canvas-presets/inner.svg', accentColor: 'rgb(255,199,0)' },
  { id: 'jux', label: 'Jux', imagePath: '/backgrounds/canvas-presets/jux.svg', accentColor: 'rgb(250,222,0)' },
  { id: 'kin', label: 'Kin', imagePath: '/backgrounds/canvas-presets/kin.svg', accentColor: 'rgb(17,168,88)' },
  { id: 'kin2', label: 'Kin2', imagePath: '/backgrounds/canvas-presets/kin2.svg', accentColor: 'rgb(96,80,206)' },
  { id: 'radient', label: 'Radient', imagePath: '/backgrounds/canvas-presets/radient.svg', accentColor: 'rgb(11,128,189)' },
  { id: 'ray', label: 'Ray', imagePath: '/backgrounds/canvas-presets/ray.svg', accentColor: 'rgb(255,0,102)' },
  { id: 'relative', label: 'Relative', imagePath: '/backgrounds/canvas-presets/relative.svg', accentColor: 'rgb(32,141,102)' },
  { id: 'release', label: 'Release', imagePath: '/backgrounds/canvas-presets/release.svg', accentColor: 'rgb(247,209,221)' },
  { id: 'reveal', label: 'Reveal', imagePath: '/backgrounds/canvas-presets/reveal.svg', accentColor: 'rgb(0,84,182)' },
  { id: 'rise', label: 'Rise', imagePath: '/backgrounds/canvas-presets/rise.svg', accentColor: 'rgb(254,102,0)' },
  { id: 'solace', label: 'Solace', imagePath: '/backgrounds/canvas-presets/solace.svg', accentColor: 'rgb(250,112,202)' },
  { id: 'tamber', label: 'Tamber', imagePath: '/backgrounds/canvas-presets/tamber.svg', accentColor: 'rgb(71,214,206)' },
  { id: 'tility', label: 'Tility', imagePath: '/backgrounds/canvas-presets/tility.svg', accentColor: 'rgb(171,100,255)' },
  { id: 'tone', label: 'Tone', imagePath: '/backgrounds/canvas-presets/tone.svg', accentColor: 'rgb(251,66,61)' },
  { id: 'unison', label: 'Unison', imagePath: '/backgrounds/canvas-presets/unison.svg', accentColor: 'rgb(0,43,181)' },
  { id: 'zip', label: 'Zip', imagePath: '/backgrounds/canvas-presets/zip.svg', accentColor: 'rgb(181,11,101)' },
];

export function getCanvasPreset(id: string): CanvasPreset | null {
  return CANVAS_PRESETS.find((p) => p.id === id) ?? null;
}

/** CanvasPreset.accentColor ships as 'rgb(r,g,b)' from the Figma export, but
 * StyleConfig.accentColor requires hex — bridges the two when a preset is applied. */
export function rgbStringToHex(rgb: string): string {
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return '#FFFFFF';
  const [, r, g, b] = match;
  return (
    '#' +
    [r, g, b]
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}
