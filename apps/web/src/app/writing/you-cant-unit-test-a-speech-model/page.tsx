import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  acidEyebrow,
  proseBlock,
  proseCode,
  proseColumn,
  proseHeading,
  proseText,
} from '@/lib/variants';

const TITLE = 'You can’t unit-test a speech model';
const DESCRIPTION =
  'Building an evaluation harness for a production transcription pipeline, and what it found.';
const PUBLISHED = '2026-08-12';

export const metadata: Metadata = {
  title: `${TITLE} — Ordio`,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'article',
    publishedTime: PUBLISHED,
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  alternates: { canonical: '/writing/you-cant-unit-test-a-speech-model' },
};

const NORMALISE_SOURCE = `export function normalise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\\w\\s']/g, '')
    .split(/\\s+/)
    .filter(Boolean);
}`;

const CHUNKING_RESULTS = `one long request     22.0% error   12 missing    4 invented
six short requests   28.3% error    2 missing   13 invented`;

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className={cn(proseHeading({ level: 'section' }), proseBlock({ kind: 'heading' }))}>
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className={cn(proseText(), proseBlock())}>{children}</p>;
}

export default function Page() {
  return (
    <article className={cn(proseColumn(), 'py-16 sm:py-24')}>
      <header>
        <p className={acidEyebrow}>
          <time dateTime={PUBLISHED}>12 August 2026</time>
        </p>
        <h1 className={cn(proseHeading({ level: 'title' }), 'mt-3')}>{TITLE}</h1>
        <p className={cn(proseText({ size: 'lede' }), proseBlock({ kind: 'lede' }))}>
          {DESCRIPTION}
        </p>
      </header>

      <P>
        After my test, the speech model got 23.9% of the words wrong when I read aloud. On the
        standard benchmark it got 6.2% wrong. Nearly four times worse.
      </P>
      <P>
        The easy explanation was my accent. I’m Nigerian, and the benchmark I had set was mostly
        narrated by British and American accents. I didn’t publish that, as my goal was focused on
        African creators.
      </P>
      <P>
        I eventually took a look at how the errors were distributed. When you score a transcript,
        you compare it to the correct version you wrote yourself and count three types of errors:
        incorrect words, invented words, and missing words. An accent can lead to incorrect words.
        Even if you’re misheard, you’re still understood. My transcript showed 84 missing words
        compared to 54 incorrect ones.
      </P>
      <P>
        Missing words could have had a more serious impact. However, “missing” is counted from the
        reference’s perspective. All it indicates is that the reference and the output don’t agree on
        whether a word is present. It doesn’t specify which one is incorrect. I initially thought the
        model was the one that was wrong. Out of those 84, 61 were my mistake.
      </P>

      <H2>Why 700 tests didn’t help</H2>
      <P>
        <Link href="/" className="text-acid-text-1 underline underline-offset-4">
          Ordio
        </Link>{' '}
        turns speech into a captioned video. It has 700 automated tests, and they’re all validated.
      </P>
      <P>
        You cannot write that kind of test for a speech model. There is no single correct output. It
        returns something roughly right, and the same audio can give different text tomorrow. That
        is not a pass or fail question. It is a measurement.
      </P>
      <P>
        So I could swap in a cheaper, worse model tomorrow and not one of those 700 tests would
        fail. The build stays green, every check passes, and the product gets worse in the only way
        users notice.
      </P>
      <P>
        I scored 20 samples against transcripts I wrote by hand: sixteen from the standard public
        benchmark, four of my own voice. An afternoon, nine cents.
      </P>
      <P>The whole comparison rests on six lines, and what matters is what they leave out:</P>

      <pre className={cn(proseCode({ kind: 'source' }), proseBlock({ kind: 'code' }))}>
        <code>{NORMALISE_SOURCE}</code>
      </pre>

      <P>
        Contractions are not expanded, so “it’s” and “it is” count as a mismatch. Numbers are not
        spelled out. Published benchmarks do both, so my scores look worse than theirs before I
        start. That was on purpose. If you don’t state your rules, nobody can compare your score to
        anyone else’s, and loosening them later quietly improves every number you have already
        published.
      </P>
      <P>The benchmark samples scored 95%, exactly as documented.</P>

      <figure className={proseBlock({ kind: 'figure' })}>
        <Image
          src="/writing/eval-benchmark-only.png"
          alt="Terminal output: 16 benchmark samples, 95.0% overall accuracy"
          width={700}
          height={424}
          className="w-full rounded-lg border border-acid-border-default"
        />
        <figcaption className={cn(proseText({ size: 'caption' }), 'mt-3')}>
          The 16 benchmark samples on their own.
        </figcaption>
      </figure>

      <P>
        If I had stopped there, which is what a benchmark-only check does, I would have written
        “transcription verified” and moved on. Adding my own voice produced the 23.9%.
      </P>

      <figure className={proseBlock({ kind: 'figure' })}>
        <Image
          src="/writing/eval-full-run.png"
          alt="Terminal output: the first full run across all 20 samples"
          width={709}
          height={829}
          className="w-full rounded-lg border border-acid-border-default"
        />
        <figcaption className={cn(proseText({ size: 'caption' }), 'mt-3')}>
          The first full run. The numbers here are the ones this article goes on to correct.
        </figcaption>
      </figure>

      <H2>What was actually wrong</H2>
      <P>
        Two recordings came back short. One returned 169 words against a 210-word reference, the
        other 197 against 228. Both stopped mid-passage at a clean sentence break, with a normal
        success response. I could see where they stopped only because the harness saves every
        transcript it scores.
      </P>
      <P>
        The first one was my mistake. I measured how long I actually spend speaking in each file,
        length minus pauses, and used the recording that wasn’t short to work out my reading speed.
        That file only had room for about 200 words. My reference claimed 228. I had copied further
        down the page than I read aloud.
      </P>
      <P>
        The second one looked real. I cut out its final 35 seconds and transcribed them alone. That
        clip returned words that appear nowhere in the full-file transcript. Same audio, same
        settings. The words are there in a short request and gone in a long one.
      </P>

      <H2>Two theories, both wrong</H2>
      <P>
        File length went first. The 35-second clip loses its ending too, so length is not the
        problem.
      </P>
      <P>
        Volume I liked enough to write down. My voice trails off at the end of that recording. Its
        last 25 seconds sit 7 dB below the file’s average, while the other two stay level. The only
        file with a quiet ending was the only one losing words. A clean pattern, and an easy fix.
      </P>
      <P>
        It failed. A loudness filter raised that quiet section by 20 dB without changing a word or
        its timing. The result came back with 167 words against the original 169, stopping at the
        same sentence. I would have published that explanation if testing it had been harder than
        one command. Three data points will support almost any line you draw through them.
      </P>
      <P>
        What did hold up is that only isolation changes the output. Whisper handles audio longer
        than 30 seconds by splitting it into windows and stitching them back together, so changing
        the file’s length moves where those splits fall.
      </P>

      <H2>The fix that wasn’t</H2>
      <P>
        So I split the recording six ways at natural pauses, every piece under 30 seconds. The last
        piece answered a question I had stopped asking. It covers the final 25 seconds as a single
        window, with no stitching, and it stops at the same place. If I had read the closing 33
        words of my reference aloud, they would be in it.
      </P>
      <P>
        My second reference was over-copied too. Both recordings, the same mistake in the same
        direction. I had copied down to a natural stopping point in the text instead of to where the
        audio stopped.
      </P>
      <P>
        That makes the bug smaller without making it go away. Against corrected references, one long
        request still drops 12 words that the split version recovers, quietly, with a success
        response. About 6% of a transcript, not the 20% I first believed.
      </P>
      <P>Splitting is not the fix either. The seams cost more than they save:</P>

      {/* Focusable because it scrolls: a keyboard user needs somewhere to land
          before arrow keys will move it (WCAG 2.1.1). */}
      <pre
        tabIndex={0}
        role="region"
        aria-label="Chunking results, scrolls horizontally"
        className={cn(proseCode({ kind: 'output' }), proseBlock({ kind: 'code' }))}
      >
        <code>{CHUNKING_RESULTS}</code>
      </pre>

      <P>
        Missing words nearly disappear and the score still gets worse. Whisper uses the audio before
        each word for context, and every cut throws that context away.
      </P>

      <H2>What this bought</H2>
      <P>
        An afternoon and nine cents found a real data-loss bug, a wrong reference inside the public
        benchmark, two wrong references of my own, and a six-point swing between two identical runs
        on the same sample.
      </P>
      <P>
        Most of that is me being wrong, which is the argument for building one rather than against
        it. All those errors already existed. The harness made them cheap to find, so being wrong
        four times cost an afternoon instead of a claim I would have had to take back in public. And
        it measures the one thing exact-answer tests cannot, which is whether the output is right.
      </P>

      <footer className={cn(proseBlock({ kind: 'heading' }), 'border-t border-acid-border-default pt-8')}>
        <p className={proseText({ size: 'caption' })}>
          The harness, dataset, and full findings are in{' '}
          <a
            href="https://github.com/ciobiano/ordio-v1/pull/20"
            className="text-acid-text-1 underline underline-offset-4"
          >
            pull request #20
          </a>
          .
        </p>
        <Link
          href="/create"
          className={cn(
            'mt-6 inline-flex items-center rounded-full bg-acid-accent px-5 py-2.5',
            'font-acid-body text-acid-label font-bold text-acid-on-accent'
          )}
        >
          Try Ordio
        </Link>
      </footer>
    </article>
  );
}
