'use client';

import { useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@Ordio/convex';

export function useExportGate(): {
  checkAndConsume: () => Promise<{ allowed: boolean }>;
} {
  const checkAndIncrementExport = useMutation(api.users.checkAndIncrementExport);

  const checkAndConsume = useCallback(async (): Promise<{ allowed: boolean }> => {
    const result = await checkAndIncrementExport();
    return { allowed: result.allowed };
  }, [checkAndIncrementExport]);

  return { checkAndConsume };
}
