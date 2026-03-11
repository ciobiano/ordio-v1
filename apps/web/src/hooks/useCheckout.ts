'use client';

import { useCallback } from 'react';

function isNigerianUser(): boolean {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone === 'Africa/Lagos';
  } catch {
    return false;
  }
}

export function useCheckout() {
  const startCheckout = useCallback(async (tier: 'creator' | 'pro') => {
    const returnUrl = window.location.origin;
    const processor = isNigerianUser() ? 'paystack' : 'stripe';

    const res = await fetch(`/api/${processor}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, returnUrl }),
    });

    if (!res.ok) {
      throw new Error('Failed to create checkout session');
    }

    const { url } = (await res.json()) as { url: string };
    window.location.href = url;
  }, []);

  return { startCheckout };
}
