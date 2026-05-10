import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock FontFace and document.fonts before importing the module
const mockLoad = vi.fn().mockResolvedValue(undefined);
const mockFontFace = vi.fn().mockImplementation(function (
  _family: string,
  _src: string,
  _descriptors: object
) {
  return { load: mockLoad };
});

const mockFontsAdd = vi.fn();
const mockDocumentFontsLoad = vi.fn().mockResolvedValue([]);
const mockGetElementById = vi.fn().mockReturnValue(null);
const mockAppendChild = vi.fn((node: { onload?: (() => void) | null }) => {
  node.onload?.();
  return node;
});

vi.stubGlobal('FontFace', mockFontFace);
vi.stubGlobal('document', {
  fonts: {
    add: mockFontsAdd,
    load: mockDocumentFontsLoad,
    ready: Promise.resolve(),
  },
  getElementById: mockGetElementById,
  createElement: vi.fn().mockReturnValue({ rel: '', href: '', onload: null, onerror: null, dataset: {} }),
  head: { appendChild: mockAppendChild },
});

// Import after stubbing globals
const { loadFont } = await import('../lib/loaders');

describe('fontLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetElementById.mockReturnValue(null);
  });

  it('loads Geist via FontFace API with the local woff2 path', async () => {
    await loadFont('Geist');

    expect(mockFontFace).toHaveBeenCalledWith(
      'Geist',
      'url(/fonts/Geist-Regular.woff2)',
      expect.objectContaining({ weight: '400' })
    );
    expect(mockLoad).toHaveBeenCalled();
    expect(mockFontsAdd).toHaveBeenCalled();
  });

  it('does not call FontFace for Google Fonts families', async () => {
    await loadFont('Inter');

    // FontFace should NOT be called for Google Fonts path
    expect(mockFontFace).not.toHaveBeenCalled();
    expect(mockAppendChild).toHaveBeenCalled();
    expect(mockDocumentFontsLoad).toHaveBeenCalledWith('400 72px "Inter"');
    expect(mockDocumentFontsLoad).toHaveBeenCalledWith('600 72px "Inter"');
  });

  it('does not wait forever when a Google Fonts stylesheet link already exists', async () => {
    mockGetElementById.mockReturnValue({ dataset: {}, id: 'gfont-Roboto' });

    await loadFont('Roboto');

    expect(mockAppendChild).not.toHaveBeenCalled();
    expect(mockDocumentFontsLoad).toHaveBeenCalledWith('400 72px "Roboto"');
    expect(mockDocumentFontsLoad).toHaveBeenCalledWith('600 72px "Roboto"');
  });
});
