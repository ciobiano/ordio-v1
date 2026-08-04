/**
 * File upload validation for the Create page.
 * Pure functions — no React, no side effects.
 */

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

const ACCEPTED_MIME_TYPES = new Set([
  'audio/flac',
  'audio/m4a',
  'audio/mp3',
  'audio/mpeg',
  'audio/mpga',
  'audio/oga',
  'audio/ogg',
  'audio/wav',
  'audio/mp4',
  'audio/aac',
  'audio/webm',
  'audio/x-flac',
  'audio/x-m4a',
  'audio/x-wav',
  // m4b — an MPEG-4 audiobook. Same container as m4a, different extension, and
  // no registered type: platforms report it as audio/mp4, audio/x-m4b, or
  // nothing at all, so the extension below is what usually carries it.
  'audio/m4b',
  'audio/x-m4b',
  'video/mp4',
  'video/mpeg',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
]);

const ACCEPTED_EXTENSIONS = new Set([
  'flac',
  'm4a',
  'm4b',
  'mp3',
  'mp4',
  'mpeg',
  'mpga',
  'oga',
  'ogg',
  'wav',
  'webm',
  'aac',
  'mov',
  'mkv',
]);

function getExtension(filename: string): string | undefined {
  return filename.split('.').pop()?.toLowerCase();
}

function isAcceptedFileType(file: File): boolean {
  if (ACCEPTED_MIME_TYPES.has(file.type)) return true;
  // Fallback: check extension when MIME is empty or generic (e.g. application/octet-stream)
  const ext = getExtension(file.name);
  return ext ? ACCEPTED_EXTENSIONS.has(ext) : false;
}

export type FileValidationError = 'too_large' | 'unsupported_format' | 'episode_too_large';

export function validateFile(file: File): FileValidationError | null {
  if (file.size > MAX_FILE_SIZE_BYTES) return 'too_large';
  if (!isAcceptedFileType(file)) return 'unsupported_format';
  return null;
}

export const MAX_EPISODE_FILE_BYTES = 250 * 1024 * 1024; // episodes route, per design

export function validateEpisodeFile(file: File): FileValidationError | null {
  if (file.size > MAX_EPISODE_FILE_BYTES) return 'episode_too_large';
  if (!isAcceptedFileType(file)) return 'unsupported_format';
  return null;
}

export const FILE_ERROR_MESSAGES: Record<FileValidationError, string> = {
  too_large: 'File is too large — maximum is 50 MB',
  unsupported_format: 'Unsupported format — try MP3, M4A, M4B, WAV, WEBM, OGG, FLAC, or MP4',
  episode_too_large: 'Episode is too large — maximum is 250 MB',
};

/**
 * The <input type="file" accept="..."> string, derived from the same sets
 * validateFile() checks.
 *
 * **This is the only accept list. Never hand-write another one.** A duplicate
 * is what greys out files the app would happily take: `audio/*` is not reliably
 * expanded by every browser/OS file dialog, so each format needs its extension
 * spelled out, and a copy of the list always drifts from this one.
 *
 * It has now caused the same bug twice. First for m4a, which was patched into
 * the copy rather than fixed at the source; then for mp3, which the copy never
 * gained — so the picker greyed out mp3 files that validateFile() accepted.
 * Both copies are gone: `UploadActionSheet` (which overwrites `input.accept` at
 * click time, so the JSX value never survived the tap) and `StudioDesk` now
 * import this.
 */
export const FILE_ACCEPT_ATTRIBUTE = [
  ...Array.from(ACCEPTED_MIME_TYPES),
  ...Array.from(ACCEPTED_EXTENSIONS, (ext) => `.${ext}`),
].join(',');
