export {
  encodeVideo,
  type EncodeVideoOptions,
  type EncodeResult,
  hasWebCodecsSupport,
} from './videoEncoder';
export { encodeVideoFFmpeg } from './ffmpegEncoder';
export { renderFrame, type FrameOptions } from './frameRenderer';
export { loopTimestamps } from './backgroundFrameStream';
export {
  drawWordSwapCaptions,
  drawPhraseCutCaptions,
  drawStaticHighlightCaptions,
  measureWordSwapCaptionBlock,
  measurePhraseCutCaptionBlock,
  measureStaticHighlightCaptionBlock,
} from '../processing/captions';
