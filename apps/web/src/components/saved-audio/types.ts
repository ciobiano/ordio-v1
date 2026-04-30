import type { GenericId } from 'convex/values';

export type SessionSummary = {
  id: GenericId<'sessions'>;
  name: string;
  durationMs: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
};

export const SORT_OPTIONS = ['Newest', 'Name', 'Duration'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

