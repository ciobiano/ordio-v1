'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'ordio:mic-grant';
const GRANT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type MicPermissionStatus = 'unknown' | 'granted' | 'denied' | 'prompt';

interface StoredGrant {
  grantedAt: number;
}

function readStoredGrant(): StoredGrant | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredGrant;
  } catch {
    return null;
  }
}

function writeStoredGrant(): void {
  try {
    const grant: StoredGrant = { grantedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(grant));
  } catch {
    // localStorage can throw (Safari private browsing, quota exceeded) —
    // non-fatal, the grant cache is best-effort only.
  }
}

function clearStoredGrant(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Same as above — non-fatal.
  }
}

interface UseMicPermissionResult {
  status: MicPermissionStatus;
  recordGrant: () => void;
  recordDenial: () => void;
}

export function useMicPermission(): UseMicPermissionResult {
  const [livePermission, setLivePermission] = useState<PermissionState | null>(null);

  useEffect(() => {
    let permissionStatus: PermissionStatus | null = null;

    async function subscribe() {
      try {
        
        permissionStatus = await navigator.permissions.query({
          name: 'microphone' as PermissionName,
        });
        setLivePermission(permissionStatus.state);
        permissionStatus.onchange = () => {
          setLivePermission(permissionStatus!.state);
        };
      } catch {
        setLivePermission(null);
      }
    }

    void subscribe();
    return () => {
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, []);

  const recordGrant = useCallback(() => {
    writeStoredGrant();
  }, []);

  const recordDenial = useCallback(() => {
    clearStoredGrant();
  }, []);

  const stored = readStoredGrant();
  const isLive = stored !== null && Date.now() - stored.grantedAt < GRANT_TTL_MS;
  const status: MicPermissionStatus = livePermission ?? (isLive ? 'granted' : 'unknown');

  return { status, recordGrant, recordDenial };
}