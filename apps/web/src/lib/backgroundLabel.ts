/**
 * Turning an uploaded file's name into something worth showing.
 *
 * Both background pickers used `file.name.replace(/\.[^.]+$/, '')` and stored
 * whatever came back. On iOS that is frequently not a name at all: a file
 * pulled through the Files app or a Safari download arrives as
 * `CFNetworkDownload_34hlmZ.tmp`, so the user's background ends up labelled
 * with a temp handle they have never seen and cannot match to anything.
 *
 * The test applied here is narrow on purpose: reject only what is plainly a
 * machine artefact. Camera-roll names like `IMG_4523` are kept — they read as
 * noise, but they are what the user's own photo library shows, so they still
 * help them find the right item. Anything genuinely typed by a person is
 * preserved untouched.
 */

/** Longer than this is a paste or a path, not a name someone will read. */
const MAX_LABEL_LENGTH = 60;

const MEANINGLESS_NAMES: RegExp[] = [
  /^CFNetworkDownload/i, // iOS Safari download temp
  /^(tmp|temp)[-_.]?/i, // tmp, temp_9931
  /^RPReplay/i, // iOS screen recording
  /^(image|video|photo|movie|clip|file|download|untitled|unknown)$/i,
  /^\d+$/, // Android MediaStore hands over bare ids
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i, // UUID
  /^[0-9a-f]{24,}$/i, // long hex blob
];

/** Extensions that mean "this file was in transit", never chosen. */
const TRANSIENT_EXTENSIONS = new Set(['tmp', 'temp', 'download', 'part', 'crdownload']);

function extensionOf(fileName: string): string | undefined {
  const match = /\.([^.]+)$/.exec(fileName);
  return match?.[1].toLowerCase();
}

/**
 * A label worth storing, or `undefined` when the filename carries no meaning.
 *
 * Callers should supply their own fallback — a numbered one beats a shared
 * constant, since several uploads would otherwise be indistinguishable.
 */
export function deriveBackgroundLabel(fileName: string): string | undefined {
  const extension = extensionOf(fileName);
  if (extension && TRANSIENT_EXTENSIONS.has(extension)) return undefined;

  const stem = fileName.replace(/\.[^.]+$/, '').trim();
  if (stem.length === 0) return undefined;
  if (MEANINGLESS_NAMES.some((pattern) => pattern.test(stem))) return undefined;

  return stem.length > MAX_LABEL_LENGTH ? `${stem.slice(0, MAX_LABEL_LENGTH).trimEnd()}…` : stem;
}

/**
 * The label to store for an upload: the file's own name when it means
 * something, else the next number in that media type's list.
 *
 * Numbered rather than a bare "My background", because the picker shows these
 * side by side and three identical labels are no more useful than three temp
 * handles.
 */
export function backgroundLabelForUpload(fileName: string, existingCount: number): string {
  return deriveBackgroundLabel(fileName) ?? `Background ${existingCount + 1}`;
}
