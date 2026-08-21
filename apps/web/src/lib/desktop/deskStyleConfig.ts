/**
 * Desk state, as the renderer's StyleConfig.
 *
 * The desk and the export screen grew separate style models: the desk keeps
 * `font`/`fontSize`/`textColor`/`align`, the engine reads a StyleConfig out of
 * useUIStore. Without a translation the desk's export would encode whatever
 * the *mobile* screen last set — every choice made in the Style panel silently
 * dropped, and the resulting file wrong in a way nothing on screen predicted.
 *
 * Pure and separate from the sheet that calls it, because the failure it
 * prevents is invisible: a field mapped to the wrong place still produces a
 * video, just not the one on the canvas.
 */

import type { StyleConfig } from '@Ordio/shared';
import { RATIO, FONTS } from './deskCatalog';
import { CAPTION_ANIMATIONS } from '@/lib/captionAnimations';
import type { DeskState } from './deskState';

/**
 * Long edge of an exported frame. 1080 across the short edge is the usual
 * social target; the other dimension follows the chosen ratio.
 */
const SHORT_EDGE = 1080;

/** Frame size for a ratio, with the short edge pinned to SHORT_EDGE. */
export function frameSize(format: DeskState['format']): { width: number; height: number } {
  const [rw, rh] = RATIO[format];
  return rw <= rh
    ? { width: SHORT_EDGE, height: Math.round((SHORT_EDGE * rh) / rw) }
    : { width: Math.round((SHORT_EDGE * rw) / rh), height: SHORT_EDGE };
}

/**
 * The desk's typefaces are named to match the engine's enum, so the cast is
 * safe — but only while that holds, which is what this guard is for. A face
 * the engine does not know would fail schema validation deep inside the
 * encoder, long after the export button was pressed.
 */
const ENGINE_FACES = new Set<StyleConfig['fontFamily']>([
  'Inter', 'Roboto', 'Outfit', 'Poppins', 'Montserrat',
  'Space Grotesk', 'DM Sans', 'Playfair Display', 'Lora',
  'Instrument Serif', 'Instrument Sans',
]);

function faceFor(name: string): StyleConfig['fontFamily'] {
  return ENGINE_FACES.has(name as StyleConfig['fontFamily'])
    ? (name as StyleConfig['fontFamily'])
    : 'Inter';
}

/**
 * The style bundle that runs a given animation.
 *
 * Falls back to the schema's own default rather than throwing: an unknown
 * mechanic should cost the chosen animation, not the export.
 */
function styleIdFor(mechanic: DeskState['anim']): StyleConfig['captionStyleId'] {
  const match = CAPTION_ANIMATIONS.find((option) => option.mechanic === mechanic);
  return (match?.styleId as StyleConfig['captionStyleId']) ?? 'minimal-lower-third';
}

export function deskStyleConfig(state: DeskState): StyleConfig {
  const { width, height } = frameSize(state.format);

  return {
    width,
    height,
    backgroundColor: state.bgColor,
    textColor: state.textColor,
    fontFamily: faceFor(state.font),
    fontSize: state.fontSize,
    waveColor: state.waveColor,
    /* The desk stores character spacing in em, because that is what CSS wants
       for the DOM preview. The renderer works in pixels, so it is resolved
       against the font size here rather than shipped as a unitless number
       that would read as 0.02px. */
    characterSpacing: Math.max(-12, Math.min(12, state.charSpacing * state.fontSize)),
    lineHeight: state.lineHeight,
    textAlign: state.align,
    /* The desk says "middle" where the engine says "center". */
    verticalAlign: state.vAlign === 'middle' ? 'center' : state.vAlign,
    /* Only a fixed count is a chunk size. Every other break mode is
       content-aware, which the engine expresses by leaving this unset. */
    chunkWords:
      state.breakMode === 'quantity' && typeof state.breakQty === 'number'
        ? Math.max(2, Math.min(12, state.breakQty))
        : undefined,
    backgroundScrim: 'flat',
    /* The animation the Motion panel is showing.
   
       This was pinned to 'minimal-lower-third'. The panel offered five
       choices, the state recorded which one you picked, and this constant
       threw it away — so every desk export ran a hard phrase cut regardless,
       and no test noticed because a valid StyleConfig came out either way. */
    captionStyleId: styleIdFor(state.anim),
    strokeWidth: state.strokeW > 0 ? Math.min(8, state.strokeW) : undefined,
    strokeColor: state.strokeW > 0 ? state.strokeColor : undefined,
    glowIntensity: state.glow > 0 ? state.glow : undefined,
    /* A halo in the text's own colour reads as light; a second hue reads as a
       drop shadow. Matches what PlayerStage draws. */
    glowColor: state.glow > 0 ? state.textColor : undefined,
    /* The Reframe panel's fit, which previously stopped at the panel: a photo
       or video backdrop was always composed with the default, whichever
       button was lit. */
    contentFit: state.fit,
    accentColor: state.emphasisColor,
    autoFit: state.autoFit,
  };
}


/**
 * A StyleConfig read back into desk state.
 *
 * The inverse of `deskStyleConfig`, and it has to exist because the projection
 * runs in one direction continuously: anything that writes the shared style
 * directly — Director applying a look, most of all — would be overwritten by
 * the desk's own values on the very next slider move. A look that vanishes
 * when you touch anything is worse than a look that never applied.
 *
 * Partial on purpose. Only the fields the desk actually models come back;
 * `background` has no desk equivalent and is deliberately left in the store,
 * where `deskStyleConfig` never mentions it and so cannot clobber it.
 *
 * Kept beside its inverse so the two are read together. A field added to one
 * and forgotten in the other is silent — it simply stops surviving.
 */
export function deskStateFromStyle(style: StyleConfig): Partial<DeskState> {
  const patch: Partial<DeskState> = {
    bgColor: style.backgroundColor,
    textColor: style.textColor,
    fontSize: style.fontSize,
    waveColor: style.waveColor,
    lineHeight: style.lineHeight,
    align: style.textAlign,
    /* The engine says "center", the desk says "middle". */
    vAlign: style.verticalAlign === 'center' ? 'middle' : style.verticalAlign,
    strokeW: style.strokeWidth ?? 0,
    glow: style.glowIntensity ?? 0,
  };

  /* Only adopt a face the desk can offer in its own picker, or the Style panel
     would show nothing selected while the canvas rendered something else. */
  if (FONTS.some((f) => f.name === style.fontFamily)) {
    patch.font = style.fontFamily;
  }

  /* Character spacing is stored in em by the desk and in pixels by the
     renderer, so it is resolved back against the font size it was resolved
     against on the way out. */
  if (style.fontSize > 0) {
    patch.charSpacing = (style.characterSpacing ?? 0) / style.fontSize;
  }

  if (style.strokeColor) patch.strokeColor = style.strokeColor;
  if (style.accentColor) patch.emphasisColor = style.accentColor;
  if (style.contentFit) patch.fit = style.contentFit;

  const mechanic = CAPTION_ANIMATIONS.find(
    (option) => option.styleId === style.captionStyleId
  )?.mechanic;
  if (mechanic) patch.anim = mechanic;

  return patch;
}
