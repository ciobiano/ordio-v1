export {
  encodeVideo,
  type EncodeVideoOptions,
  type EncodeResult,
  hasWebCodecsSupport,
  encodeVideoFFmpeg,
  renderFrame,
  type FrameOptions,
  drawWordSwapCaptions,
  drawPhraseCutCaptions,
  drawStaticHighlightCaptions,
  measureWordSwapCaptionBlock,
  measurePhraseCutCaptionBlock,
  measureStaticHighlightCaptionBlock,
} from './video';

export { CAPTION_STYLE_PRESETS, getCaptionStylePreset, type CaptionStylePreset, type CaptionMechanic } from './captions/presets';
export { LOOK_PRESETS, getLookPreset, resolveLookStyle, type LookPreset, type LookPresetId } from './captions/lookPresets';

export {
  decodeBlobToAudioBuffer,
  concatAudioBuffers,
  type DecodeMediaResult,
  detectSilentRegions,
  type SilentRegion,
} from './media';

export { loadFont, loadGraphic, getGraphic } from './loaders';
export { loadCuratedBackground, loadCustomBackground } from './loaders/backgroundLoader';

export { drawPillBars, drawCircleWaveform, drawSpectrogram } from './waveforms';

export {
  findActiveDisplaySegment,
  buildOneLinePhraseSegments,
  buildSentenceSegments,
  buildStackSegments,
  type CaptionDisplaySegment,
  type MeasureCaptionText,
} from './captions/display';
export { buildSmartSegments } from './captions/segmentation';

export { BACKGROUND_LIBRARY, getCuratedBackground } from './backgrounds/backgroundLibrary';
export { drawGradientBackground } from './backgrounds/gradientBackground';
export type { GradientVariant, GradientDecoration } from './backgrounds/gradientBackground';
export {
  GRADIENT_BACKGROUND_OPTIONS,
} from './backgrounds/gradientOptions';

export { drawGraphic } from './graphic';
export { isWebGLAvailable } from './webgl-detect';

export type {
  WaveformVariant,
  GraphicStyleId,
  CanvasLayout,
  CaptionStyleId,
  CaptionTransform,
  CaptionGroup,
} from './types';
