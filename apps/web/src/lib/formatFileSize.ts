/**
 * Human-readable file size formatting.
 * Used by upload confirmation dialogs and anywhere file metadata is displayed.
 */

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Derive a clean media-type label from a File object.
 * Prefers the file extension; falls back to MIME subtype.
 */
export function formatMediaType(file: File): string {
  const ext = file.name.split('.').pop()?.toUpperCase();
  if (ext && ext !== file.name.toUpperCase()) return ext;
  const mime = file.type.split('/')[1]?.toUpperCase();
  return mime ?? 'Audio';
}
