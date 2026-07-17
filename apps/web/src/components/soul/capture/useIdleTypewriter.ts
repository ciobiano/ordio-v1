// apps/web/src/components/soul/capture/useIdleTypewriter.ts
'use client';

import { useTypewriter } from '@/hooks/useTypewriter';

const IDLE_PHRASES = ['Press and hold to record', 'speak your truth'];

export function useIdleTypewriter(active: boolean): string {
  return useTypewriter(IDLE_PHRASES, active).text;
}
