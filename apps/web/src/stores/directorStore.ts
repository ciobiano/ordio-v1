'use client';

import { create } from 'zustand';
import type { StyleConfig, DirectorResponse } from '@Ordio/shared/schemas';
import { resolveLookStyle, type LookPresetId } from '@Ordio/engine';
import { useUIStore } from './uiStore';
import { useProcessingStore } from './processingStore';

export interface DirectorLook {
  presetId: LookPresetId;
  style: StyleConfig;
  hookGroupIndex: number;
}

interface DirectorState {
  looks: DirectorLook[] | null;
  isGenerating: boolean;
  error: string | null;
  /** POSTs /api/direct and resolves the 3 raw looks into full StyleConfigs. */
  generateLooks: () => Promise<void>;
  /** Always a fresh /api/direct call — no pre-fetched batch to cycle through. */
  reroll: () => Promise<void>;
  /** Sets style, and marks exactly one captionGroup as the hook (clearing any previous one). */
  applyLook: (index: number) => void;
  reset: () => void;
}

async function fetchLooks(): Promise<DirectorLook[]> {
  const { transcript, captionGroups } = useProcessingStore.getState();
  const { style, format } = useUIStore.getState();

  const res = await fetch('/api/direct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript,
      captionGroupTexts: captionGroups.map((group) => group.text),
      format,
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'Director request failed');
  }

  const data = (await res.json()) as DirectorResponse;
  return data.looks.map((look) => ({
    presetId: look.presetId,
    style: resolveLookStyle(style, look.presetId, look.overrides),
    hookGroupIndex: look.hookGroupIndex,
  }));
}

export const useDirectorStore = create<DirectorState>((set, get) => ({
  looks: null,
  isGenerating: false,
  error: null,

  generateLooks: async () => {
    set({ isGenerating: true, error: null });
    try {
      const looks = await fetchLooks();
      set({ looks, isGenerating: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Director request failed',
        isGenerating: false,
      });
    }
  },

  reroll: async () => {
    await get().generateLooks();
  },

  applyLook: (index) => {
    const look = get().looks?.[index];
    if (!look) return;

    useUIStore.getState().setStyle(look.style);

    const { captionGroups } = useProcessingStore.getState();
    const nextGroups = captionGroups.map((group, i) => ({
      ...group,
      role: i === look.hookGroupIndex ? ('hook' as const) : undefined,
    }));
    useProcessingStore.setState({ captionGroups: nextGroups });
  },

  reset: () => set({ looks: null, isGenerating: false, error: null }),
}));
