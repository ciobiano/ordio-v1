import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ordio.space';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${siteUrl}/writing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${siteUrl}/writing/you-cant-unit-test-a-speech-model`,
      // A dated article, not a living page. A fixed date is honest and stops
      // every deploy from claiming the content changed.
      lastModified: new Date('2026-08-12'),
      changeFrequency: 'yearly',
      priority: 0.8,
    },
  ];
}
