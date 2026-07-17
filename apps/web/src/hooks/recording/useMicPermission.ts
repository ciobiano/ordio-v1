// hooks/recording/useMicPermission.ts
// Tracks microphone permission across sessions so the app can skip its own
// "requesting access" UI churn when the user already granted mic access.
//
// The native browser permission *dialog* is entirely browser-controlled — we
// can't suppress or pre-approve it. What this hook controls is our own
// app-level state: whether we treat access as already-settled (and can go
// straight into getUserMedia without extra UI) or as unknown/stale (and
// should let the browser's own prompt run its course).
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
    // Private browsing / quota exceeded — the browser's own permission
    // cache is still the fallback, so this is safe to swallow.
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
  /** Best-known permission status, merging the live Permissions API (where supported) with our cached grant. */
  status: MicPermissionStatus;
  /** Call once getUserMedia resolves successfully, to record the grant for future sessions. */
  recordGrant: () => void;
  /** Call when getUserMedia rejects with a permission/denied error, to drop any stale cached grant. */
  recordDenial: () => void;
}

export function useMicPermission(): UseMicPermissionResult {
  const [livePermission, setLivePermission] = useState<PermissionState | null>(null);

  useEffect(() => {
    let permissionStatus: PermissionStatus | null = null;

    async function subscribe() {
      try {
        // Safari has no 'microphone' PermissionName support — query() throws
        // a TypeError there, so livePermission just stays null and we fall
        // back entirely to the cached-grant heuristic below.
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