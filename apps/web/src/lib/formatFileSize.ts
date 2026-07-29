/**
 * Human-readable file size formatting.
 * Used by upload confirmation dialogs and anywhere file metadata is displayed.
 */

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Rendered into a small fixed-size badge — mime subtypes like "quicktime"
// or "x-matroska" overflow it uncapped, so this is a badge label, not a
// full-fidelity type name.
const MEDIA_TYPE_LABEL_MAX_LENGTH = 4;

/**
 * Derive a clean media-type label from a File object.
 * Prefers the file extension; falls back to MIME subtype.
 */
export function formatMediaType(file: File): string {
  const ext = file.name.split('.').pop()?.toUpperCase();
  const label = ext && ext !== file.name.toUpperCase() ? ext : file.type.split('/')[1]?.toUpperCase();
  return (label ?? 'AUD').slice(0, MEDIA_TYPE_LABEL_MAX_LENGTH);
}
