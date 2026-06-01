const OPENAI_TRANSCRIPTION_EXTENSIONS = new Set([
  'flac',
  'm4a',
  'mp3',
  'mp4',
  'mpeg',
  'mpga',
  'oga',
  'ogg',
  'wav',
  'webm',
]);

const MIME_EXTENSION_ALIASES = new Map<string, string>([
  ['audio/aac', 'm4a'],
  ['audio/flac', 'flac'],
  ['audio/m4a', 'm4a'],
  ['audio/mp3', 'mp3'],
  ['audio/mp4', 'm4a'],
  ['audio/mpeg', 'mp3'],
  ['audio/mpga', 'mpga'],
  ['audio/oga', 'oga'],
  ['audio/ogg', 'ogg'],
  ['audio/wav', 'wav'],
  ['audio/webm', 'webm'],
  ['audio/x-flac', 'flac'],
  ['audio/x-m4a', 'm4a'],
  ['audio/x-wav', 'wav'],
  ['video/mp4', 'mp4'],
  ['video/mpeg', 'mpeg'],
  ['video/webm', 'webm'],
]);

function getExtension(filename: string): string | null {
  const extension = filename.split('.').pop()?.toLowerCase();
  return extension && extension !== filename.toLowerCase() ? extension : null;
}

function getSafeUploadName(file: Blob): string | null {
  if (!(file instanceof File)) return null;
  return file.name;
}

export function getOpenAITranscriptionFilename(file: Blob): string {
  const originalExtension = getExtension(getSafeUploadName(file) ?? '');
  if (originalExtension && OPENAI_TRANSCRIPTION_EXTENSIONS.has(originalExtension)) {
    return `audio.${originalExtension}`;
  }

  const mimeType = file.type.toLowerCase().split(';')[0]?.trim() ?? '';
  const mappedExtension = MIME_EXTENSION_ALIASES.get(mimeType);
  return `audio.${mappedExtension ?? 'webm'}`;
}
