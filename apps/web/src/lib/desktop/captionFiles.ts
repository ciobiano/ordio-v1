/**
 * Caption files for the desk's text exports: SRT, WebVTT and plain text.
 *
 * One cue per caption line — the same lines the transcript pane and the
 * timeline show — so the file a person downloads breaks where the video
 * breaks. The export sheet used to preview these and then, whichever format
 * was chosen, encode and download the video.
 */
import type { Word } from '@Ordio/shared';

export interface CaptionCue {
  start: number;
  end: number;
  words: Pick<Word, 'text'>[];
}

export type CaptionFileKind = 'srt' | 'vtt' | 'txt';

function stamp(seconds: number, separator: ',' | '.'): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}${separator}${pad(ms, 3)}`;
}

const cueText = (cue: CaptionCue) => cue.words.map((w) => w.text).join(' ').replace(/\s+/g, ' ').trim();

export function buildCaptionFile(kind: CaptionFileKind, cues: CaptionCue[]): string {
  const usable = cues.filter((cue) => cueText(cue).length > 0);

  if (kind === 'txt') return usable.map(cueText).join('\n') + (usable.length ? '\n' : '');

  if (kind === 'srt') {
    return usable
      .map((cue, i) => `${i + 1}\n${stamp(cue.start, ',')} --> ${stamp(cue.end, ',')}\n${cueText(cue)}\n`)
      .join('\n');
  }

  return (
    'WEBVTT\n\n' +
    usable.map((cue) => `${stamp(cue.start, '.')} --> ${stamp(cue.end, '.')}\n${cueText(cue)}\n`).join('\n')
  );
}

export const CAPTION_FILE_MIME: Record<CaptionFileKind, string> = {
  srt: 'application/x-subrip',
  vtt: 'text/vtt',
  txt: 'text/plain',
};
