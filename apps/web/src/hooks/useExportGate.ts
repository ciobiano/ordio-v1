'use client';

import { useCallback } from 'react';
import { useMutation } from 'convex/react';
import { anyApi } from 'convex/server';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const ANON_DAILY_LIMIT = 3;

type ExportReason = 'ok' | 'anon_limit' | 'auth_limit';

function getTodayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `ordio_exports_${y}-${m}-${day}`;
}

function getAnonCount(): number {
  const raw = localStorage.getItem(getTodayKey());
  return raw ? parseInt(raw, 10) : 0;
}

function incrementAnonCount(): void {
  const key = getTodayKey();
  const current = getAnonCount();
  localStorage.setItem(key, String(current + 1));
}

export function useExportGate(): {
  checkAndConsume: () => Promise<{ allowed: boolean; reason: ExportReason }>;
} {
  const { isAuthenticated } = useCurrentUser();
  const checkAndIncrementExport = useMutation(anyApi.users.checkAndIncrementExport);

  const checkAndConsume = useCallback(async (): Promise<{
    allowed: boolean;
    reason: ExportReason;
  }> => {
    if (!isAuthenticated) {
      const count = getAnonCount();
      if (count >= ANON_DAILY_LIMIT) {
        return { allowed: false, reason: 'anon_limit' };
      }
      incrementAnonCount();
      return { allowed: true, reason: 'ok' };
    }

    const result = await checkAndIncrementExport();
    if (!result.allowed) {
      return { allowed: false, reason: 'auth_limit' };
    }
    return { allowed: true, reason: 'ok' };
  }, [isAuthenticated, checkAndIncrementExport]);

  return { checkAndConsume };
}
