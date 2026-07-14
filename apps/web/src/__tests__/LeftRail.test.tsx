import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeftRail } from '@/components/studio/LeftRail';

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  usePaginatedQuery: () => ({
    results: [
      { id: 's1', name: 'Why I quit my design job', durationMs: 47000, createdAt: Date.now() },
      { id: 's2', name: 'Untitled recording', durationMs: 58000, createdAt: Date.now() },
    ],
  }),
}));
vi.mock('@Ordio/convex', () => ({
  api: { sessions: { listMySessionsPaginated: 'sessions:listMySessionsPaginated' } },
}));

describe('LeftRail', () => {
  it('shows the Library in idle view and opens a clip on click', () => {
    const onOpenClip = vi.fn();
    render(<LeftRail view="idle" activeSessionId={null} onOpenClip={onOpenClip} transcript={[]} />);
    expect(screen.getByText('Library')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Why I quit my design job'));
    expect(onOpenClip).toHaveBeenCalledWith('s1');
  });

  it('shows the Transcript in edit view', () => {
    render(
      <LeftRail
        view="edit"
        activeSessionId="s1"
        onOpenClip={vi.fn()}
        transcript={[{ text: 'Hello', start: 0, end: 0.4 }]}
      />
    );
    expect(screen.getByText('Transcript')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
