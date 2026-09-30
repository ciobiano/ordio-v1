/**
 * The desk's text exports. These guard the bug that motivated the module:
 * picking SRT, VTT or Transcript encoded and downloaded the video instead.
 */
import { describe, it, expect } from 'vitest';
import { buildCaptionFile } from '@/lib/desktop/captionFiles';

const cues = [
  { start: 0.4, end: 2.1, words: [{ text: 'Nobody' }, { text: 'tells' }, { text: 'you' }] },
  { start: 61.25, end: 3725.5, words: [{ text: 'ship' }, { text: 'it.' }] },
  { start: 4000, end: 4001, words: [{ text: '  ' }] },
];

describe('caption files', () => {
  it('writes numbered SRT cues with comma milliseconds', () => {
    expect(buildCaptionFile('srt', cues)).toBe(
      '1\n00:00:00,400 --> 00:00:02,100\nNobody tells you\n\n' +
        '2\n00:01:01,250 --> 01:02:05,500\nship it.\n'
    );
  });

  it('writes a WEBVTT header and full-stop milliseconds', () => {
    expect(buildCaptionFile('vtt', cues)).toBe(
      'WEBVTT\n\n00:00:00.400 --> 00:00:02.100\nNobody tells you\n\n' +
        '00:01:01.250 --> 01:02:05.500\nship it.\n'
    );
  });

  it('writes plain text one line per caption', () => {
    expect(buildCaptionFile('txt', cues)).toBe('Nobody tells you\nship it.\n');
  });

  it('writes nothing but the header for an empty transcript', () => {
    expect(buildCaptionFile('srt', [])).toBe('');
    expect(buildCaptionFile('vtt', [])).toBe('WEBVTT\n\n');
    expect(buildCaptionFile('txt', [])).toBe('');
  });
});
