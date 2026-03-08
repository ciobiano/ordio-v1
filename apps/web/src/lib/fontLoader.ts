/**
 * Loads Google Fonts dynamically so canvas can use them.
 * Fonts are cached — each font is only fetched once per session.
 */

const GOOGLE_FONTS_CSS = 'https://fonts.googleapis.com/css2';

const FONT_CONFIG: Record<string, string> = {
  Inter: 'Inter:wght@300;400;600;700',
  Roboto: 'Roboto:wght@300;400;500;700',
  Outfit: 'Outfit:wght@300;400;600;700',
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
  const spec = FONT_CONFIG[fontFamily];
  if (!spec) return;

  try {
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
