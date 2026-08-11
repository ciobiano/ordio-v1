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

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { loadManifest } from './manifest.js';
import { transcribe, estimateCostUsd, TRANSCRIPTION_MODEL } from './transcribe.js';
import { wordErrorRate } from './wer.js';
import { formatReport, type Scored } from './report.js';

const DEFAULT_MANIFEST = 'samples/manifest.json';

interface Args {
  manifest: string;
  out?: string;
  /** Only score samples whose id or split contains this. */
  only?: string;
}

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2);
  const valueOf = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const flagged = new Set(['--out', '--only']);
  const manifest = args.find(
    (a, i) => !a.startsWith('--') && !flagged.has(args[i - 1] ?? '')
  );
  return { manifest: manifest ?? DEFAULT_MANIFEST, out: valueOf('--out'), only: valueOf('--only') };
}

async function main(): Promise<void> {
  const { manifest, out, only } = parseArgs(process.argv);
  const manifestPath = resolve(process.cwd(), manifest);

  const all = await loadManifest(manifestPath);
  const samples = only
    ? all.filter((s) => s.id.includes(only) || s.split.includes(only))
    : all;

  if (samples.length === 0) {
    console.error(
      only
        ? `Nothing in ${manifestPath} matches "${only}".`
        : `No samples in ${manifestPath}. See samples/README.md.`
    );
    process.exit(1);
  }

  await mkdir(resolve(dirname(manifestPath), 'hypothesis'), { recursive: true });

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

      // Always keep what the model actually said. A WER without its transcript
      // is a number you cannot argue with or learn from — and the interesting
      // question is never "how bad", it is "bad how". Deletions and
      // substitutions look identical in the table and mean opposite things.
      await writeFile(
        resolve(dirname(manifestPath), 'hypothesis', `${sample.id}.txt`),
        text.trim() + '\n',
        'utf8'
      );

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
