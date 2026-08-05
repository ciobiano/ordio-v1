'use client';

import { useCallback } from 'react';

function isNigerianUser(): boolean {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone === 'Africa/Lagos';
  } catch {
    return false;
  }
}

const PRICES: Record<'nigerian' | 'international', Record<'creator' | 'pro', string>> = {
  nigerian:      { creator: '₦5,000/mo', pro: '₦12,000/mo' },
  international: { creator: '$9/mo',     pro: '$19/mo'      },
};

export function useCheckout() {
  const market = isNigerianUser() ? 'nigerian' : 'international';

  const priceLabel = useCallback(
    (tier: 'creator' | 'pro') => PRICES[market][tier],
    [market]
  );

  const startCheckout = useCallback(async (tier: 'creator' | 'pro') => {
    const processor = market === 'nigerian' ? 'paystack' : 'stripe';

    // No returnUrl: the route derives the origin from the request itself, so a
    // caller cannot nominate where checkout sends the user afterwards.
    const res = await fetch(`/api/${processor}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
    });

    if (!res.ok) {
      throw new Error('Failed to create checkout session');
    }

    const { url } = (await res.json()) as { url: string };
    window.location.href = url;
  }, [market]);

  return { startCheckout, priceLabel };
}
