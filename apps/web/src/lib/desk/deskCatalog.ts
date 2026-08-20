/**
 * Static option tables for the desktop editor, transcribed from the design's
 * runtime constants.
 *
 * Every `lock` flag in the source has been dropped: the design was authored
 * against the pre-pivot Creator tier, and Ordio takes no money — so all ten
 * faces, all six presets, every ratio, visual and bed are simply open.
 */

export const DESK_DURATION_FALLBACK = 26;

export type ToolId =
  | 'presets'
  | 'style'
  | 'timing'
  | 'audio'
  | 'trim'
  | 'reframe'
  | 'director';

/**
 * Media is deliberately absent — it lives in the morphing left column.
 *
 * Presets is a category of its own rather than a row inside Style. It writes
 * across every Style tab, so it was never a Style setting; and it is where
 * imported artwork and video will land, which is a different kind of thing
 * again from a slider.
 */
export const TOOL_COPY: Record<ToolId, { title: string; hint: string }> = {
  presets: { title: 'Presets', hint: 'A whole look in one tap — type, colour and motion together' },
  style: { title: 'Caption style', hint: 'Everything here lands on the canvas live' },
  timing: { title: 'Word timing', hint: 'Nudge any word until the highlight lands on the beat' },
  audio: { title: 'Audio', hint: 'Voice level, and a bed underneath it' },
  trim: { title: 'Trim', hint: 'Handles on the audio track, cuts commit with Apply' },
  reframe: { title: 'Reframe', hint: 'Pick a ratio, a fit, and the safe zone you post into' },
  director: { title: 'Director', hint: 'Three looks built from this clip' },
};

export const ANIMS = [
  { id: 'reveal', label: 'Reveal', hint: 'Sentence holds, each word lights as spoken' },
  { id: 'pop', label: 'Pop', hint: 'One word at a time, on its own beat' },
  { id: 'cut', label: 'Cut', hint: 'Short phrase, hard cut' },
  { id: 'karaoke', label: 'Karaoke', hint: 'Block holds, highlight moves word to word' },
  { id: 'bounce', label: 'Bounce', hint: 'Word scales in on its start frame' },
] as const;

export type AnimId = (typeof ANIMS)[number]['id'];

export const FONTS = [
  { name: 'Inter', label: 'Neutral', family: "'Inter', sans-serif" },
  { name: 'Roboto', label: 'Clean', family: "'Roboto', sans-serif" },
  { name: 'Outfit', label: 'Rounded', family: "'Outfit', sans-serif" },
  { name: 'Poppins', label: 'Modern', family: "'Poppins', sans-serif" },
  { name: 'Montserrat', label: 'Editorial', family: "'Montserrat', sans-serif" },
  { name: 'Space Grotesk', label: 'Technical', family: "'Space Grotesk', sans-serif" },
  { name: 'DM Sans', label: 'Soft', family: "'DM Sans', sans-serif" },
  { name: 'Playfair Display', label: 'Display', family: "'Playfair Display', serif" },
  { name: 'Lora', label: 'Serif', family: "'Lora', serif" },
  { name: 'Instrument Serif', label: 'Cinematic', family: "'Instrument Serif', serif" },
] as const;

export interface CaptionPreset {
  id: string;
  name: string;
  sample: string;
  font: string;
  textCase: 'none' | 'uppercase' | 'capitalize';
  text: string;
  wordBg: string;
  wordText: string;
  stroke: number;
  anim: AnimId;
}

export const PRESETS: CaptionPreset[] = [
  { id: 'hype', name: 'Hype', sample: 'BUILT THIS', font: 'Montserrat', textCase: 'uppercase', text: '#f4f5ef', wordBg: '#c6ff3d', wordText: '#0a0b0a', stroke: 0, anim: 'pop' },
  { id: 'clean', name: 'Clean', sample: 'built this', font: 'Inter', textCase: 'none', text: '#f4f5ef', wordBg: '#f4f5ef', wordText: '#0a0b0a', stroke: 0, anim: 'reveal' },
  { id: 'karaoke', name: 'Karaoke', sample: 'built this', font: 'Outfit', textCase: 'none', text: '#f4f5ef', wordBg: '#6be0ff', wordText: '#0a0b0a', stroke: 0, anim: 'karaoke' },
  { id: 'street', name: 'Street', sample: 'BUILT THIS', font: 'Space Grotesk', textCase: 'uppercase', text: '#c6ff3d', wordBg: '#ff5c5c', wordText: '#f4f5ef', stroke: 3, anim: 'pop' },
  { id: 'cinema', name: 'Cinema', sample: 'built this', font: 'Instrument Serif', textCase: 'none', text: '#f4f5ef', wordBg: '#f4f5ef', wordText: '#0a0b0a', stroke: 0, anim: 'cut' },
  { id: 'sticker', name: 'Sticker', sample: 'Built This', font: 'Poppins', textCase: 'capitalize', text: '#0a0b0a', wordBg: '#c6ff3d', wordText: '#0a0b0a', stroke: 0, anim: 'bounce' },
];

export const VISUALS = [
  { id: 'bars', label: 'Bars' },
  { id: 'circle', label: 'Orbit' },
  { id: 'spectrogram', label: 'Spectrum' },
  { id: 'orb', label: 'Orb' },
  { id: 'baseline', label: 'Baseline' },
  { id: 'none', label: 'Clean' },
] as const;

export type VisualId = (typeof VISUALS)[number]['id'];

export const ART = ['Tamber', 'Ray', 'Zip', 'Jux', 'Solace', 'Tone', 'Unison', 'Rise'] as const;

export type FormatId = 'square' | 'vertical' | 'horizontal' | 'instagram';

export const RATIO: Record<FormatId, [number, number]> = {
  square: [1, 1],
  vertical: [9, 16],
  horizontal: [16, 9],
  instagram: [4, 5],
};

export const FORMATS: { id: FormatId; label: string; w: number; h: number }[] = [
  { id: 'square', label: '1:1', w: 22, h: 22 },
  { id: 'vertical', label: '9:16', w: 15, h: 25 },
  { id: 'horizontal', label: '16:9', w: 27, h: 16 },
  { id: 'instagram', label: '4:5', w: 19, h: 24 },
];

export type SafeId = 'none' | 'tiktok' | 'reels';

export const SAFE: Record<SafeId, { label: string; top: string; bottom: string }> = {
  none: { label: 'Off', top: '0%', bottom: '0%' },
  tiktok: { label: 'TikTok', top: '12%', bottom: '20%' },
  reels: { label: 'Reels', top: '10%', bottom: '24%' },
};

export const BEDS = [
  { id: 'none', label: 'None' },
  { id: 'lofi', label: 'Lo-fi' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'warm', label: 'Warm keys' },
  { id: 'upload', label: 'Upload' },
] as const;

export type BedId = (typeof BEDS)[number]['id'];

export const LOOKS = [
  { name: 'Neon Pop', hint: 'Acid on Zip, one word at a time', comp: 'Zip', preset: 'hype' },
  { name: 'Street Bold', hint: 'Outline caps on Tone', comp: 'Tone', preset: 'street' },
  { name: 'Cream Block', hint: 'Karaoke block on Solace', comp: 'Solace', preset: 'karaoke' },
] as const;
