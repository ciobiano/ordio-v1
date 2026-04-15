/**
 * Loads Google Fonts dynamically so canvas can use them.
 * Fonts are cached — each font is only fetched once per session.
 */

const GOOGLE_FONTS_CSS = 'https://fonts.googleapis.com/css2';

const LOCAL_FONTS: Record<string, { src: string; weight: string }> = {
  Geist: { src: '/fonts/Geist-Regular.woff2', weight: '400' },
};

const FONT_CONFIG: Record<string, string> = {
  Inter: 'Inter:wght@300;400;600;700',
  Roboto: 'Roboto:wght@300;400;500;700',
  Outfit: 'Outfit:wght@300;400;600;700',
  Poppins: 'Poppins:wght@300;400;600;700',
  Montserrat: 'Montserrat:wght@300;400;600;700',
  'Space Grotesk': 'Space+Grotesk:wght@300;400;600;700',
  'DM Sans': 'DM+Sans:wght@300;400;600;700',
  'Playfair Display': 'Playfair+Display:wght@300;400;600;700',
};

const loaded = new Set<string>();
const loading = new Map<string, Promise<void>>();

export async function loadFont(fontFamily: string): Promise<void> {
  if (loaded.has(fontFamily)) return;

  const existing = loading.get(fontFamily);
  if (existing) return existing;

  const promise = doLoad(fontFamily);
  loading.set(fontFamily, promise);
  return promise;
}

async function doLoad(fontFamily: string): Promise<void> {
  try {
    const local = LOCAL_FONTS[fontFamily];
    if (local) {
      const face = new FontFace(fontFamily, `url(${local.src})`, { weight: local.weight });
      await face.load();
      document.fonts.add(face);
      loaded.add(fontFamily);
      return;
    }

    const spec = FONT_CONFIG[fontFamily];
    if (!spec) return;

    // Inject a <link> for Google Fonts CSS
    const linkId = `gfont-${fontFamily}`;
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = `${GOOGLE_FONTS_CSS}?family=${encodeURIComponent(spec)}&display=swap`;
      document.head.appendChild(link);
    }

    // Wait for the font to be ready via the FontFace API
    await document.fonts.load(`600 72px "${fontFamily}"`);
    loaded.add(fontFamily);
  } catch {
    // Silently fall back — canvas will use sans-serif
    loaded.add(fontFamily);
  } finally {
    loading.delete(fontFamily);
  }
}
