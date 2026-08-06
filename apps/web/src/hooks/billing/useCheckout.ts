'use client';

import { useCallback } from 'react';

function isNigerianUser(): boolean {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone === 'Africa/Lagos';
  } catch {
    return false;
  }
}

/**
 * The one purchasable tier, priced per market.
 *
 * `pro` used to appear here with a price. Nothing ever sold it — every call
 * site passes 'creator', and no feature gate names it — so the labels were
 * decoration for a product that did not exist. It survives in the database
 * union as a legacy stored value, not as something anyone can buy.
 *
 * Each price buys a different monthly credit allowance rather than a different
 * feature set; see `MONTHLY_ALLOWANCE` in @Ordio/shared. That is what lets ₦999
 * and $9.99 both stay profitable without pricing Nigeria out.
 */
const PRICES: Record<'nigerian' | 'international', Record<PurchasableTier, string>> = {
  nigerian:      { creator: '₦999/mo'  },
  international: { creator: '$9.99/mo' },
};

/** Tiers a user can actually buy — narrower than the tiers we can store. */
export type PurchasableTier = 'creator';

export function useCheckout() {
  const market = isNigerianUser() ? 'nigerian' : 'international';

  const priceLabel = useCallback(
    (tier: PurchasableTier) => PRICES[market][tier],
    [market]
  );

  const startCheckout = useCallback(async (tier: PurchasableTier) => {
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
