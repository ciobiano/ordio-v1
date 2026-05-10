/**
 * File upload validation for the Create page.
 * Pure functions — no React, no side effects.
 */

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

const ACCEPTED_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
]);

const ACCEPTED_EXTENSIONS = new Set([
  'mp3', 'wav', 'm4a', 'aac', 'ogg', 'webm', 'flac',
  'mp4', 'mov', 'mkv',
]);

function getExtension(filename: string): string | undefined {
  return filename.split('.').pop()?.toLowerCase();
}

export function isAcceptedFileType(file: File): boolean {
  if (ACCEPTED_MIME_TYPES.has(file.type)) return true;
  // Fallback: check extension when MIME is empty or generic (e.g. application/octet-stream)
  const ext = getExtension(file.name);
  return ext ? ACCEPTED_EXTENSIONS.has(ext) : false;
}

export type FileValidationError = 'too_large' | 'unsupported_format';

export function validateFile(file: File): FileValidationError | null {
  if (file.size > MAX_FILE_SIZE_BYTES) return 'too_large';
  if (!isAcceptedFileType(file)) return 'unsupported_format';
  return null;
}

export const FILE_ERROR_MESSAGES: Record<FileValidationError, string> = {
  too_large: 'File is too large — maximum is 50 MB',
  unsupported_format: 'Unsupported format — try MP3, WAV, M4A, or MP4',
};
