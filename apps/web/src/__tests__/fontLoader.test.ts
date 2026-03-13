import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock FontFace and document.fonts before importing the module
const mockLoad = vi.fn().mockResolvedValue(undefined);
const mockFontFace = vi.fn().mockImplementation(function (_family: string, _src: string, _descriptors: object) {
  return { load: mockLoad };
});

const mockFontsAdd = vi.fn();

vi.stubGlobal('FontFace', mockFontFace);
vi.stubGlobal('document', {
  fonts: {
    add: mockFontsAdd,
    load: vi.fn().mockResolvedValue([]),
  },
  createElement: vi.fn().mockReturnValue({ rel: '', href: '', onload: null }),
  head: { appendChild: vi.fn() },
});

// Import after stubbing globals
const { loadFont } = await import('../lib/fontLoader');

describe('fontLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads Geist via FontFace API with the local woff2 path', async () => {
    await loadFont('Geist');

    expect(mockFontFace).toHaveBeenCalledWith(
      'Geist',
      'url(/fonts/Geist-Regular.woff2)',
      expect.objectContaining({ weight: '400' }),
    );
    expect(mockLoad).toHaveBeenCalled();
    expect(mockFontsAdd).toHaveBeenCalled();
  });

  it('does not call FontFace for Google Fonts families', async () => {
    await loadFont('Inter');

    // FontFace should NOT be called for Google Fonts path
    expect(mockFontFace).not.toHaveBeenCalled();
  });
});
