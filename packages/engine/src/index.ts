export {
  encodeVideo,
  type EncodeVideoOptions,
  type EncodeResult,
  hasWebCodecsSupport,
  encodeVideoFFmpeg,
  renderFrame,
  type FrameOptions,
  drawKaraokeCaptions,
  karaokeNonActiveFills,
  measureKaraokeCaptionBlock,
  drawSpotlightCaptions,
  drawStackCaptions,
  measureSpotlightCaptionBlock,
  measureStackCaptionBlock,
} from './video';

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

export { drawGraphic } from './graphic';
export { isWebGLAvailable } from './webgl-detect';

export type {
  WaveformVariant,
  GraphicStyleId,
  CanvasLayout,
  CaptionMode,
  CaptionAnimation,
  CaptionTransform,
  CaptionGroup,
} from './types';
