import type { MetadataRoute } from 'next';

/**
 * The installed-app manifest.
 *
 * Both icons here pointed at files that did not exist — /icon-192.png and
 * /icon-512.png were 404s, so an install had no icon at all and fell back to
 * a screenshot of the page. They are drawn now by
 * scripts/generate-app-icons.mjs, from the same geometry as app/icon.svg.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ordio',
    short_name: 'Ordio',
    description:
      'Turn a voice recording into a captioned video worth posting. Free, and it stays free.',
    start_url: '/',
    display: 'standalone',
    /* Ink, not pure black. --acid-bg-base is #0a0b0a, so a #000000 splash
       screen handed off to an app that is not quite black — a visible step at
       the one moment the two are shown back to back. */
    background_color: '#0a0b0a',
    theme_color: '#0a0b0a',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
