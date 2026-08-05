import { describe, it, expect, beforeEach } from 'vitest';
import { useProcessingStore } from '@/stores/processingStore';
import { useHistoryStore } from '@/stores/historyStore';
import type { Word } from '@Ordio/shared/schemas';
import type { CaptionGroup } from '@/stores';

/**
 * Dropping a caption you do not want on screen.
 *
 * The editor could split and merge but never remove, so an unwanted line — a
 * false start, a mis-transcription — had nowhere to go. Delete removes the
 * block and nothing else: its words stay in the transcript, so the audio is
 * untouched and no timing downstream moves. Cutting audio is the Trim panel.
 */

const transcript: Word[] = Array.from({ length: 6 }, (_, i) => ({
  text: `w${i + 1}`,
  start: i * 0.5,
  end: i * 0.5 + 0.4,
}));

function group(indices: number[]): CaptionGroup {
  return {
    wordIndices: indices,
    text: indices.map((i) => transcript[i].text).join(' '),
    start: transcript[indices[0]].start,
    end: transcript[indices[indices.length - 1]].end,
  };
}

const store = () => useProcessingStore.getState();

beforeEach(() => {
  useHistoryStore.getState().clearHistory();
  useProcessingStore.setState({
    transcript,
    captionGroups: [group([0, 1]), group([2, 3]), group([4, 5])],
    selectedGroupIndices: [],
  });
});

describe('stores/processingStore: deleteGroup', () => {
  it('removes only the block asked for', () => {
    store().deleteGroup(1);

    expect(store().captionGroups.map((g) => g.text)).toEqual(['w1 w2', 'w5 w6']);
  });

  it('leaves the transcript alone, so the audio and every other caption keep their timing', () => {
    const before = store().transcript;
    store().deleteGroup(1);

    expect(store().transcript).toEqual(before);
    expect(store().captionGroups[1].start).toBe(transcript[4].start);
  });

  it('clears the selection rather than letting it point at a neighbour', () => {
    // Indices shift up on removal, so a held selection would silently retarget
    // whatever moved into the gap — and the next Split would hit the wrong row.
    useProcessingStore.setState({ selectedGroupIndices: [1] });
    store().deleteGroup(1);

    expect(store().selectedGroupIndices).toEqual([]);
  });

  it('is undoable', () => {
    // No confirm dialog on this one, so undo is what makes it safe.
    store().deleteGroup(1);

    const { past } = useHistoryStore.getState();
    expect(past).toHaveLength(1);
    expect(past[0].label).toBe('delete caption');
  });

  it('ignores an index that is not there', () => {
    store().deleteGroup(9);
    store().deleteGroup(-1);

    expect(store().captionGroups).toHaveLength(3);
    // And no undo entry, so the transport's undo does not become a no-op step.
    expect(useHistoryStore.getState().past).toHaveLength(0);
  });

  it('can empty the list', () => {
    store().deleteGroup(2);
    store().deleteGroup(1);
    store().deleteGroup(0);

    expect(store().captionGroups).toEqual([]);
    // The words are all still there — the video just carries no captions.
    expect(store().transcript).toHaveLength(6);
  });
});
