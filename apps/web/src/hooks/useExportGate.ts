'use client';

import { useCallback } from 'react';
import { useMutation } from 'convex/react';
import { anyApi } from 'convex/server';

export function useExportGate(): {
  checkAndConsume: () => Promise<{ allowed: boolean }>;
} {
  const checkAndIncrementExport = useMutation(anyApi.users.checkAndIncrementExport);

  const checkAndConsume = useCallback(async (): Promise<{ allowed: boolean }> => {
    const result = await checkAndIncrementExport();
    return { allowed: result.allowed };
  }, [checkAndIncrementExport]);

  return { checkAndConsume };
}
