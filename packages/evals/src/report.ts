/**
 * Turns scores into the table that goes in the case study.
 *
 * Per-sample rows first, then per-split means, then the overall. The split
 * rows are the point: a single averaged WER across easy and hard audio is the
 * number that flatters you, and the gap between splits is the number that
 * tells a reader something.
 */

import type { WerResult } from './wer.js';
import { accuracyPercent } from './wer.js';

export interface Scored {
  id: string;
  split: string;
  durationSec: number;
  result: WerResult;
}

/** Aggregate WER over samples, weighted by reference length. */
export function aggregate(scores: Scored[]): WerResult {
  const totals = scores.reduce(
    (acc, { result }) => ({
      substitutions: acc.substitutions + result.substitutions,
      deletions: acc.deletions + result.deletions,
      insertions: acc.insertions + result.insertions,
      referenceWords: acc.referenceWords + result.referenceWords,
    }),
    { substitutions: 0, deletions: 0, insertions: 0, referenceWords: 0 }
  );

  const errors = totals.substitutions + totals.deletions + totals.insertions;

  // Weighted by word count, not a mean of per-sample rates. A ten-word clip
  // and a three-thousand-word chapter are not equally informative, and
  // averaging the rates would let the clip swing the headline figure.
  return { ...totals, wer: totals.referenceWords === 0 ? 0 : errors / totals.referenceWords };
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

function padLeft(value: string, width: number): string {
  return value.length >= width ? value : ' '.repeat(width - value.length) + value;
}

const COLUMNS = [
  { header: 'sample', width: 26 },
  { header: 'words', width: 7 },
  { header: 'sub', width: 6 },
  { header: 'del', width: 6 },
  { header: 'ins', width: 6 },
  { header: 'WER', width: 8 },
  { header: 'accuracy', width: 10 },
] as const;

function row(label: string, words: number, r: WerResult): string {
  return [
    pad(label, COLUMNS[0].width),
    padLeft(String(words), COLUMNS[1].width),
    padLeft(String(r.substitutions), COLUMNS[2].width),
    padLeft(String(r.deletions), COLUMNS[3].width),
    padLeft(String(r.insertions), COLUMNS[4].width),
    padLeft(r.wer.toFixed(4), COLUMNS[5].width),
    padLeft(`${accuracyPercent(r.wer).toFixed(1)}%`, COLUMNS[6].width),
  ].join('');
}

export function formatReport(scores: Scored[], meta: { model: string; costUsd: number }): string {
  if (scores.length === 0) return 'No samples scored — is the manifest empty?';

  const header = COLUMNS.map((c) =>
    c.header === 'sample' ? pad(c.header, c.width) : padLeft(c.header, c.width)
  ).join('');
  const rule = '─'.repeat(header.length);

  const lines: string[] = [
    `Transcription eval — ${meta.model}`,
    `${scores.length} samples · ${new Date().toISOString().slice(0, 10)}`,
    '',
    header,
    rule,
  ];

  for (const s of [...scores].sort((a, b) => a.split.localeCompare(b.split) || a.id.localeCompare(b.id))) {
    lines.push(row(s.id, s.result.referenceWords, s.result));
  }

  const splits = [...new Set(scores.map((s) => s.split))].sort();
  if (splits.length > 1) {
    lines.push(rule);
    for (const split of splits) {
      const subset = scores.filter((s) => s.split === split);
      const agg = aggregate(subset);
      lines.push(row(`${split} (${subset.length})`, agg.referenceWords, agg));
    }
  }

  const overall = aggregate(scores);
  lines.push(rule);
  lines.push(row('OVERALL', overall.referenceWords, overall));
  lines.push('');
  lines.push(`Audio scored: ${(scores.reduce((n, s) => n + s.durationSec, 0) / 60).toFixed(1)} min`);
  lines.push(`Est. cost:    $${meta.costUsd.toFixed(4)}`);

  return lines.join('\n');
}
