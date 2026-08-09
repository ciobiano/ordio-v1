/**
 * Runs the transcription eval and prints the report.
 *
 *   pnpm --filter @Ordio/evals eval [manifest] [--out report.txt]
 *
 * Sequential rather than parallel on purpose. The dataset is tens of samples,
 * not thousands, so wall-clock time is irrelevant — and a serial run gives
 * per-sample progress, stays inside any rate limit, and makes a failure
 * obviously attributable to one file.
 */

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadManifest } from './manifest.js';
import { transcribe, estimateCostUsd, TRANSCRIPTION_MODEL } from './transcribe.js';
import { wordErrorRate } from './wer.js';
import { formatReport, type Scored } from './report.js';

const DEFAULT_MANIFEST = 'samples/manifest.json';

function parseArgs(argv: string[]): { manifest: string; out?: string } {
  const args = argv.slice(2);
  const outIndex = args.indexOf('--out');
  const out = outIndex >= 0 ? args[outIndex + 1] : undefined;
  const manifest = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
  return { manifest: manifest ?? DEFAULT_MANIFEST, out };
}

async function main(): Promise<void> {
  const { manifest, out } = parseArgs(process.argv);
  const manifestPath = resolve(process.cwd(), manifest);

  const samples = await loadManifest(manifestPath);
  if (samples.length === 0) {
    console.error(`No samples in ${manifestPath}. See samples/README.md.`);
    process.exit(1);
  }

  console.error(`Scoring ${samples.length} samples against ${TRANSCRIPTION_MODEL}…\n`);

  const scores: Scored[] = [];
  let totalSeconds = 0;

  for (const [index, sample] of samples.entries()) {
    const position = `[${index + 1}/${samples.length}]`;
    try {
      const { text, durationSec } = await transcribe(sample.audioPath);
      const result = wordErrorRate(sample.referenceText, text);

      totalSeconds += durationSec;
      scores.push({ id: sample.id, split: sample.split, durationSec, result });

      console.error(`${position} ${sample.id.padEnd(26)} WER ${result.wer.toFixed(4)}`);
    } catch (err) {
      // One unreadable file must not discard the samples already paid for.
      console.error(`${position} ${sample.id.padEnd(26)} FAILED — ${(err as Error).message}`);
    }
  }

  const report = formatReport(scores, {
    model: TRANSCRIPTION_MODEL,
    costUsd: estimateCostUsd(totalSeconds),
  });

  console.log('\n' + report);

  if (out) {
    await writeFile(resolve(process.cwd(), out), report + '\n', 'utf8');
    console.error(`\nWritten to ${out}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
