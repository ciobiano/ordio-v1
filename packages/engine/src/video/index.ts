export {
  encodeVideo,
  type EncodeVideoOptions,
  type EncodeResult,
  hasWebCodecsSupport,
} from './videoEncoder';
export { encodeVideoFFmpeg } from './ffmpegEncoder';
export { renderFrame, type FrameOptions } from './frameRenderer';
export {
  drawWordSwapCaptions,
  drawPhraseCutCaptions,
  drawStaticHighlightCaptions,
  measureWordSwapCaptionBlock,
  measurePhraseCutCaptionBlock,
  measureStaticHighlightCaptionBlock,
} from '../processing/captions';
