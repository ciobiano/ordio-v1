/**
 * Every failure Ordio can report, by name.
 *
 * A code is the contract between whoever detects a failure and whoever tells
 * the person about it: the transcribe route sends one in its JSON body, the
 * client hooks wrap their failures in one, and the toast and banner read their
 * copy from here. Nothing on screen string-matches an error message.
 *
 * Copy rule: the title says what happened, the detail says what to do next.
 * Neither mentions a provider, a status code or a stack — the code itself is
 * shown as a small reference line so a report can name it exactly.
 *
 * This module is imported by route handlers, so it must stay free of React,
 * browser globals and toast libraries.
 */

export type ErrorSeverity = 'error' | 'warning' | 'info';

export interface ErrorCopy {
  title: string;
  detail: string;
  severity: ErrorSeverity;
}

const error = (title: string, detail: string): ErrorCopy => ({ title, detail, severity: 'error' });
const warning = (title: string, detail: string): ErrorCopy => ({ title, detail, severity: 'warning' });
const info = (title: string, detail: string): ErrorCopy => ({ title, detail, severity: 'info' });

export const ERROR_CATALOG = {
  // ── Microphone & recording ─────────────────────────────────────────
  MIC_PERMISSION_DENIED: error(
    'Microphone access is blocked',
    'Allow microphone access for this site in your browser settings, then try again.'
  ),
  MIC_NOT_FOUND: error(
    'No microphone found',
    'Connect a microphone and try again, or upload a recording instead.'
  ),
  MIC_IN_USE: error(
    'Your microphone is busy',
    'Another app or tab is using it. Close that, then try again.'
  ),
  MIC_INSECURE_CONTEXT: error(
    'Recording needs a secure connection',
    'Open Ordio over https to use your microphone.'
  ),
  RECORDING_UNSUPPORTED: error(
    'This browser cannot record audio',
    'Try Chrome, Edge or Safari, or upload a file instead.'
  ),
  MIC_START_FAILED: error(
    'Recording could not start',
    'Ordio could not open your microphone. Try again.'
  ),
  RECORDING_EMPTY: error(
    'Nothing was recorded',
    'The take came back empty. Check your microphone and record again.'
  ),

  // ── Choosing a file ────────────────────────────────────────────────
  FILE_EMPTY: error('This file is empty', 'It has no data in it. Pick another file.'),
  FILE_TOO_LARGE: error(
    'File is too large',
    'Uploads can be up to 50 MB. Trim it or export it at a lower bitrate.'
  ),
  FILE_UNSUPPORTED_FORMAT: error(
    'Unsupported file type',
    'Try MP3, M4A, M4B, WAV, WEBM, OGG, FLAC or MP4.'
  ),
  EPISODE_FILE_TOO_LARGE: error('Episode is too large', 'Episodes can be up to 250 MB.'),

  // ── Reading the audio ──────────────────────────────────────────────
  AUDIO_NO_TRACK: error(
    'No audio in this file',
    'It has no sound track to transcribe. Pick a file with audio in it.'
  ),
  AUDIO_CODEC_UNSUPPORTED: error(
    'Cannot read this audio',
    'Your browser cannot decode the audio in this file. Convert it to MP3 or WAV and try again.'
  ),
  AUDIO_DECODE_FAILED: error(
    'Could not read this file',
    'It may be damaged, or not actually audio. Try another file.'
  ),
  AUDIO_EMPTY: error(
    'No sound in this file',
    'Ordio decoded it but found no audio. Pick another file or record again.'
  ),
  AUDIO_TOO_LARGE_TO_TRANSCRIBE: error(
    'Audio is too long to transcribe',
    'Even compressed, it is over the transcription upload limit. Trim it and try again.'
  ),

  // ── Enhancement ────────────────────────────────────────────────────
  ENHANCE_NOT_CONFIGURED: error(
    'Enhancement is not available',
    'Audio enhancement is not set up right now. Turn it off to continue.'
  ),
  ENHANCE_TIMEOUT: error(
    'Enhancement took too long',
    'The enhancement service did not answer in time. Turn it off, or try again.'
  ),
  ENHANCE_NETWORK: error(
    'Could not reach enhancement',
    'Check your connection, or turn enhancement off and retry.'
  ),
  ENHANCE_SERVICE_ERROR: error(
    'Enhancement failed',
    'The enhancement service returned an error. Turn enhancement off and retry.'
  ),
  ENHANCE_OUTPUT_UNREADABLE: error(
    'Enhanced audio was unreadable',
    'Enhancement returned audio Ordio could not play. Turn it off and retry.'
  ),

  // ── Transcription ──────────────────────────────────────────────────
  AUTH_REQUIRED: error('You are signed out', 'Sign in again, then retry.'),
  INSUFFICIENT_CREDITS: error(
    'Out of transcription credits',
    'You have used all your transcription minutes.'
  ),
  CREDITS_CHECK_FAILED: error(
    'Could not check your credits',
    'Ordio could not reach the credit ledger. Nothing was charged — try again.'
  ),
  TRANSCRIBE_RATE_LIMITED: error(
    'Too many transcriptions',
    'You have hit the hourly limit. Wait a little, then try again.'
  ),
  TRANSCRIBE_FILE_TOO_LARGE: error(
    'Audio is too large to transcribe',
    'Transcription has an upload size limit. Trim the recording and try again.'
  ),
  TRANSCRIBE_BAD_REQUEST: error(
    'Audio did not arrive',
    'The upload reached Ordio without any audio in it. Try again.'
  ),
  TRANSCRIBE_AUDIO_REJECTED: error(
    'Could not transcribe this audio',
    'The transcription service could not read it. Convert it to MP3 or WAV and try again.'
  ),
  TRANSCRIBE_PROVIDER_BUSY: error(
    'Transcription is busy',
    'The transcription service is overloaded. Nothing was charged — try again in a minute.'
  ),
  TRANSCRIBE_PROVIDER_UNREACHABLE: error(
    'Transcription service unreachable',
    'Ordio could not reach the transcription service. Nothing was charged — try again in a minute.'
  ),
  TRANSCRIBE_TIMEOUT: error(
    'Transcription timed out',
    'This recording took too long to transcribe. Nothing was charged — try a shorter one.'
  ),
  TRANSCRIBE_UNAVAILABLE: error(
    'Transcription is unavailable',
    'This is a problem on our side, not with your recording. Try again later.'
  ),
  TRANSCRIBE_FAILED: error(
    'Transcription failed',
    'Something went wrong while transcribing. Nothing was charged — try again.'
  ),
  TRANSCRIBE_NO_SPEECH: warning(
    'No speech detected',
    'Ordio did not hear any words, so this video will have no captions.'
  ),

  // ── Saving the recording ───────────────────────────────────────────
  UPLOAD_URL_FAILED: error(
    'Could not start the upload',
    'Ordio could not prepare storage for your recording. Try again.'
  ),
  UPLOAD_FAILED: error('Upload failed', 'Your recording did not finish uploading. Try again.'),
  SESSION_SAVE_FAILED: error(
    'Could not save this session',
    'Your audio was transcribed, but saving it failed. Try again.'
  ),
  PROCESSING_FAILED: error(
    'Processing failed',
    'Processing stopped safely. You can retry from this screen.'
  ),

  // ── Connection ─────────────────────────────────────────────────────
  NETWORK_OFFLINE: error('You are offline', 'Reconnect to the internet, then try again.'),
  NETWORK_FAILED: error(
    'Connection problem',
    'Ordio could not reach the server. Check your connection and try again.'
  ),

  // ── Live captions (recording is never affected) ────────────────────
  LIVE_CAPTIONS_UNAVAILABLE: warning(
    'Live captions are off',
    'Keep recording — your captions are still made when you finish.'
  ),
  LIVE_CAPTIONS_RATE_LIMITED: warning(
    'Live captions paused',
    'You have started a lot of recordings this hour. Captions are still made when you finish.'
  ),
  LIVE_CAPTIONS_CONNECTION_FAILED: warning(
    'Live captions disconnected',
    'Keep recording — your captions are still made when you finish.'
  ),
  LIVE_CAPTIONS_SESSION_LIMIT: warning(
    'Live captions stopped',
    'They run for a limited time per take. Your captions are still made when you finish.'
  ),

  // ── Long episodes ──────────────────────────────────────────────────
  EPISODE_TOO_LONG: error(
    'Episode is too long',
    'Episodes can be up to 90 minutes. Trim it and try again.'
  ),
  EPISODE_UNDECODABLE: error(
    'Cannot read this episode',
    'Your browser cannot decode this file. Convert it to MP3 or M4A and try again.'
  ),
  EPISODE_NO_SPEECH: error(
    'Not enough speech to clip',
    'Music-heavy or mostly instrumental episodes are not supported yet.'
  ),
  EPISODE_NO_CLIPS: error(
    'No clips found',
    'Ordio could not find any moments to suggest in this episode.'
  ),
  EPISODE_PARTIAL_TRANSCRIPT: error(
    'Part of the episode was not transcribed',
    'You can find clips in the part that was, or start over.'
  ),
  EPISODE_CREDITS_RAN_OUT: error(
    'Credits ran out partway through',
    'You can find clips in the part that was transcribed.'
  ),
  EPISODE_FAILED: error('Episode processing failed', 'Something went wrong. Try again.'),
  CLIPS_AI_UNAVAILABLE: info(
    'Showing high-energy moments',
    'AI clip selection was unavailable, so these were picked from the audio instead.'
  ),
  CLIP_PREPARE_FAILED: error('Could not prepare this clip', 'Try another one.'),

  // ── Director ───────────────────────────────────────────────────────
  DIRECTOR_RATE_LIMITED: error(
    'Too many Director requests',
    'You have hit the hourly limit. Wait a little, then try again.'
  ),
  DIRECTOR_NO_LOOKS: error(
    'The Director came back empty',
    'It could not propose usable looks for this transcript. Try again.'
  ),
  DIRECTOR_UNAVAILABLE: error(
    'The Director is unavailable',
    'This is a problem on our side. Try again later.'
  ),
  DIRECTOR_FAILED: error('The Director could not propose looks', 'Try again in a moment.'),

  // ── Sessions ───────────────────────────────────────────────────────
  SESSION_NOT_FOUND: error(
    'Recording not found',
    'It has expired or was deleted. Start a new one.'
  ),
  SESSION_LOAD_FAILED: error('Could not load this recording', 'Check your connection and try again.'),
  SESSION_RENAME_FAILED: error('Could not rename this recording', 'Try again in a moment.'),
  SESSION_DELETE_FAILED: error('Could not delete this recording', 'Try again in a moment.'),

  // ── Export ─────────────────────────────────────────────────────────
  EXPORT_BACKGROUND_UNREADABLE: error(
    'Background video cannot be used',
    'This browser cannot decode it. Pick another background and export again.'
  ),
  EXPORT_CANVAS_UNAVAILABLE: error(
    'Export could not start',
    'Your browser could not create a drawing surface. Reload the page and try again.'
  ),
  EXPORT_EMPTY_OUTPUT: error(
    'Export produced no video',
    'The encoder finished without output. Try again.'
  ),
  EXPORT_OUT_OF_MEMORY: error(
    'Not enough memory to export',
    'Close other tabs, or pick a smaller format, then try again.'
  ),
  EXPORT_FAILED: error('Export failed', 'Something went wrong while making your video. Try again.'),

  // ── Backgrounds & beds ─────────────────────────────────────────────
  BACKGROUND_UNSUPPORTED_FORMAT: error('Unsupported image', 'Try JPG, PNG or WEBP.'),
  BACKGROUND_TOO_LARGE: error('Image is too large', 'Backgrounds can be up to 4 MB.'),
  BACKGROUND_NO_VIDEO: error('No video in this file', 'Pick a file with a video track.'),
  BACKGROUND_CONVERT_UNSUPPORTED: error(
    'Cannot convert this video',
    'Your browser cannot convert it. Try an MP4 instead.'
  ),
  BACKGROUND_UPLOAD_FAILED: error('Background upload failed', 'Check your connection and try again.'),
  BACKGROUND_FAILED: error('Could not add this background', 'Try another file.'),
  BED_UNREADABLE: error(
    'Could not read that audio',
    'Ordio could not decode it as audio. Try an MP3 or WAV.'
  ),

  // ── Everything else ────────────────────────────────────────────────
  AUTH_SIGN_IN_FAILED: error('Sign-in failed', 'Please try again.'),
  CLIPBOARD_BLOCKED: error('Could not copy', 'Your browser blocked the clipboard.'),
  PREVIEW_RENDER_FAILED: warning(
    'Preview is temporarily unavailable',
    'Your audio is unaffected, and export still works.'
  ),
  UNKNOWN: error('Something went wrong', 'Try again. If it keeps happening, report the reference below.'),
} as const satisfies Record<string, ErrorCopy>;

export type ErrorCode = keyof typeof ERROR_CATALOG;

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ERROR_CATALOG, value);
}
