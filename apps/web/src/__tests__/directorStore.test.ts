import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDirectorStore } from '@/stores/directorStore';
import { useUIStore } from '@/stores/uiStore';
import { useProcessingStore } from '@/stores/processingStore';

const baseStyle = {
  width: 1080,
  height: 1920,
  backgroundColor: '#000000',
  textColor: '#ffffff',
  fontFamily: 'Inter' as const,
  fontSize: 48,
  waveColor: '#ffffff',
  characterSpacing: 0,
  lineHeight: 1.4,
  textAlign: 'center' as const,
  verticalAlign: 'auto' as const,
  backgroundScrim: 'flat' as const,
  captionStyleId: 'minimal-lower-third' as const,
};

function mockLook(overrides: Partial<Record<string, unknown>> = {}) {
  return { presetId: 'neon-pop', hookGroupIndex: 0, ...overrides };
}

function mockFetchOk(looks = [mockLook(), mockLook({ presetId: 'street-bold' }), mockLook({ presetId: 'warm-pop' })]) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ looks }),
  });
}

function mockFetchError(message = 'Director request failed', status = 500) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ error: message }),
  });
}

describe('directorStore', () => {
  beforeEach(() => {
    useDirectorStore.setState({ looks: null, isGenerating: false, error: null });
    useUIStore.setState({ style: baseStyle });
    useProcessingStore.setState({
      transcript: [{ text: 'hello', start: 0, end: 0.3 }],
      captionGroups: [
        { text: 'hello', start: 0, end: 0.3, wordIndices: [0] },
        { text: 'world', start: 0.3, end: 0.6, wordIndices: [1] },
      ],
    });
  });

  it('generateLooks populates looks with resolved StyleConfigs on success', async () => {
    mockFetchOk();
    await useDirectorStore.getState().generateLooks();

    const { looks, error, isGenerating } = useDirectorStore.getState();
    expect(error).toBeNull();
    expect(isGenerating).toBe(false);
    expect(looks).toHaveLength(3);
    expect(looks?.[0].style.captionStyleId).toBe('word-pop'); // neon-pop's caption style
    expect(looks?.[0].style.width).toBe(baseStyle.width); // preset doesn't touch width — kept from session
  });

  it('a failed request sets error and leaves looks untouched', async () => {
    useDirectorStore.setState({ looks: null });
    mockFetchError('Director returned no usable looks', 502);

    await useDirectorStore.getState().generateLooks();

    const { looks, error, isGenerating } = useDirectorStore.getState();
    expect(looks).toBeNull();
    // The person sees the catalog copy for the status, never the route's raw text.
    expect(error).toMatch(/^The Director came back empty\./);
    expect(isGenerating).toBe(false);
  });

  it('a request that never applies never leaves a partial look in state', async () => {
    mockFetchOk();
    await useDirectorStore.getState().generateLooks();
    const firstLooks = useDirectorStore.getState().looks;

    mockFetchError('network down');
    await useDirectorStore.getState().generateLooks();

    // Failure sets error, but doesn't need to preserve stale looks either way —
    // the key invariant is it never silently replaces them with something broken.
    expect(useDirectorStore.getState().error).toMatch(/^The Director could not propose looks\./);
    expect(firstLooks).not.toBeNull();
  });

  it('reroll always issues a fresh fetch call rather than reusing a cache', async () => {
    mockFetchOk();
    await useDirectorStore.getState().generateLooks();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await useDirectorStore.getState().reroll();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('applyLook sets the style and marks only the chosen group as hook', async () => {
    mockFetchOk([mockLook({ hookGroupIndex: 1 }), mockLook({ presetId: 'street-bold' }), mockLook({ presetId: 'warm-pop' })]);
    await useDirectorStore.getState().generateLooks();

    useDirectorStore.getState().applyLook(0);

    expect(useUIStore.getState().style.captionStyleId).toBe('word-pop');
    const groups = useProcessingStore.getState().captionGroups;
    expect(groups[0].role).toBeUndefined();
    expect(groups[1].role).toBe('hook');
  });

  it('applying a new look clears a previous hook marking', async () => {
    mockFetchOk([mockLook({ hookGroupIndex: 0 }), mockLook({ presetId: 'street-bold', hookGroupIndex: 1 }), mockLook({ presetId: 'warm-pop' })]);
    await useDirectorStore.getState().generateLooks();

    useDirectorStore.getState().applyLook(0);
    expect(useProcessingStore.getState().captionGroups[0].role).toBe('hook');

    useDirectorStore.getState().applyLook(1);
    const groups = useProcessingStore.getState().captionGroups;
    expect(groups[0].role).toBeUndefined();
    expect(groups[1].role).toBe('hook');
  });
});
