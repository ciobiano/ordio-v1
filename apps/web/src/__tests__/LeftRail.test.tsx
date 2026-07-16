import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeftRail } from '@/components/studio/LeftRail';

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useMutation: () => vi.fn(),
  usePaginatedQuery: () => ({
    results: [
      { id: 's1', name: 'Why I quit my design job', durationMs: 47000, createdAt: Date.now() },
      { id: 's2', name: 'Untitled recording', durationMs: 58000, createdAt: Date.now() },
    ],
  }),
}));
vi.mock('@Ordio/convex', () => ({
  api: { sessions: { listMySessionsPaginated: 'sessions:listMySessionsPaginated', deleteSession: 'sessions:deleteSession' } },
}));
vi.mock('@/components/soul/captions/CaptionEditor', () => ({
  default: () => <div data-testid="caption-editor" />,
}));

describe('LeftRail', () => {
  it('shows the Library in idle view and opens a clip on click', () => {
    const onOpenClip = vi.fn();
    render(
      <LeftRail
        view="idle"
        activeSessionId={null}
        onOpenClip={onOpenClip}
        onGoIdle={vi.fn()}
        currentTime={0}
        onSeek={vi.fn()}
      />
    );
    expect(screen.getByText('Library')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Why I quit my design job'));
    expect(onOpenClip).toHaveBeenCalledWith('s1');
  });

  it('shows the real CaptionEditor in edit view', () => {
    render(
      <LeftRail
        view="edit"
        activeSessionId="s1"
        onOpenClip={vi.fn()}
        onGoIdle={vi.fn()}
        currentTime={0}
        onSeek={vi.fn()}
      />
    );
    expect(screen.getByText('Transcript')).toBeInTheDocument();
    expect(screen.getByTestId('caption-editor')).toBeInTheDocument();
  });

  it('the Transcript view has a back-to-Library control that calls onGoIdle', () => {
    const onGoIdle = vi.fn();
    render(
      <LeftRail
        view="edit"
        activeSessionId="s1"
        onOpenClip={vi.fn()}
        onGoIdle={onGoIdle}
        currentTime={0}
        onSeek={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /library/i }));
    expect(onGoIdle).toHaveBeenCalled();
  });
});
