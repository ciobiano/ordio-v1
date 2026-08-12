import type { Metadata } from 'next';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { acidEyebrow, proseBlock, proseColumn, proseHeading, proseText } from '@/lib/variants';

export const metadata: Metadata = {
  title: 'Writing — Ordio',
  description: 'Notes on building Ordio.',
  alternates: { canonical: '/writing' },
};

/**
 * The index is a plain list rather than a CMS.
 *
 * One article does not justify a content pipeline, and the shape of the data
 * is obvious enough that adding MDX later is a mechanical change. Keeping it
 * as an array means the route stays honest about how much content exists.
 */
const POSTS = [
  {
    slug: 'you-cant-unit-test-a-speech-model',
    title: 'You can’t unit-test a speech model',
    blurb:
      'Building an evaluation harness for a production transcription pipeline, and what it found.',
    published: '2026-08-12',
    readable: '12 August 2026',
  },
] as const;

export default function Page() {
  return (
    <main className={cn(proseColumn(), 'py-16 sm:py-24')}>
      <h1 className={proseHeading({ level: 'title' })}>Writing</h1>
      <p className={cn(proseText(), proseBlock({ kind: 'lede' }))}>Notes on building Ordio.</p>

      <ul>
        {POSTS.map((post) => (
          <li key={post.slug} className="border-t border-acid-border-default py-6">
            <p className={acidEyebrow}>
              <time dateTime={post.published}>{post.readable}</time>
            </p>
            <h2 className={cn(proseHeading({ level: 'section' }), 'mt-2')}>
              <Link href={`/writing/${post.slug}`}>{post.title}</Link>
            </h2>
            <p className={cn(proseText(), 'mt-2')}>{post.blurb}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
