import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@clerk/nextjs/server';
import { resolveReturnOrigin } from '@/lib/checkoutReturnUrl';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

/**
 * Keyed on a literal union rather than `Record<string, …>` so an unknown tier
 * is a lookup miss the compiler can see, not a silent `undefined`.
 */
const PRICE_IDS = {
  creator: process.env.NEXT_PUBLIC_STRIPE_CREATOR_PRICE_ID,
} as const satisfies Record<string, string | undefined>;

type Tier = keyof typeof PRICE_IDS;

function isTier(value: unknown): value is Tier {
  return typeof value === 'string' && value in PRICE_IDS;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tier } = (await request.json().catch(() => ({}))) as { tier?: unknown };
  if (!isTier(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const priceId = PRICE_IDS[tier];
  if (!priceId) {
    // Misconfigured deployment, not a bad request.
    console.error('[/api/stripe/checkout] NEXT_PUBLIC_STRIPE_CREATOR_PRICE_ID is not set');
    return NextResponse.json({ error: 'Checkout is unavailable' }, { status: 503 });
  }

  // Derived server-side, never taken from the body — see checkoutReturnUrl.ts.
  const origin = resolveReturnOrigin(request);

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}?upgrade=stripe-success`,
      cancel_url: `${origin}?upgrade=canceled`,
      metadata: { tokenIdentifier: userId },
      subscription_data: {
        metadata: { tokenIdentifier: userId },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    // Stripe error text can name price IDs and account state — log it, don't ship it.
    console.error('[/api/stripe/checkout]', err);
    return NextResponse.json({ error: 'Could not start checkout' }, { status: 502 });
  }
}
