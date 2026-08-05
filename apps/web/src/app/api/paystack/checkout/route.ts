import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { resolveReturnOrigin } from '@/lib/checkoutReturnUrl';

/**
 * One entry per purchasable tier. Keyed on a literal union rather than
 * `Record<string, …>` so an unknown tier is a lookup miss the compiler can see,
 * and so the plan code and its price can never drift apart.
 *
 * Amounts are in kobo (₦1 = 100 kobo).
 */
const PLANS = {
  creator: {
    planCode: process.env.NEXT_PUBLIC_PAYSTACK_CREATOR_PLAN_CODE,
    amountKobo: 500_000, // ₦5,000
  },
} as const satisfies Record<string, { planCode: string | undefined; amountKobo: number }>;

type Tier = keyof typeof PLANS;

function isTier(value: unknown): value is Tier {
  return typeof value === 'string' && value in PLANS;
}

/**
 * Test keys mint real tier upgrades from fake money.
 *
 * The market split is a client-side timezone read, so anyone can route
 * themselves here — a test key live in production is a free Creator
 * subscription for whoever changes their clock. Refuse rather than rely on
 * remembering to swap the key on approval day.
 */
function isTestKeyInProduction(): boolean {
  return (
    process.env.NODE_ENV === 'production' &&
    (process.env.PAYSTACK_SECRET_KEY ?? '').startsWith('sk_test_')
  );
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isTestKeyInProduction()) {
    console.error('[/api/paystack/checkout] refusing: test key in a production deployment');
    return NextResponse.json({ error: 'Checkout is unavailable' }, { status: 503 });
  }

  const { tier } = (await request.json().catch(() => ({}))) as { tier?: unknown };
  if (!isTier(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const { planCode, amountKobo } = PLANS[tier];
  if (!planCode) {
    // Misconfigured deployment, not a bad request.
    console.error('[/api/paystack/checkout] NEXT_PUBLIC_PAYSTACK_CREATOR_PLAN_CODE is not set');
    return NextResponse.json({ error: 'Checkout is unavailable' }, { status: 503 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  if (!email) {
    return NextResponse.json({ error: 'No email on account' }, { status: 400 });
  }

  // Derived server-side, never taken from the body — see checkoutReturnUrl.ts.
  const origin = resolveReturnOrigin(request);

  let paystackRes: Response;
  try {
    paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        plan: planCode,
        callback_url: `${origin}?upgrade=paystack-success`,
        metadata: { tokenIdentifier: userId },
      }),
    });
  } catch (err) {
    console.error('[/api/paystack/checkout] network', err);
    return NextResponse.json({ error: 'Could not start checkout' }, { status: 502 });
  }

  if (!paystackRes.ok) {
    // Provider text can name plan codes and account state — log it, don't ship it.
    console.error('[/api/paystack/checkout]', paystackRes.status, await paystackRes.text());
    return NextResponse.json({ error: 'Could not start checkout' }, { status: 502 });
  }

  const { data } = (await paystackRes.json()) as { data?: { authorization_url?: string } };
  if (!data?.authorization_url) {
    console.error('[/api/paystack/checkout] no authorization_url in response');
    return NextResponse.json({ error: 'Could not start checkout' }, { status: 502 });
  }

  return NextResponse.json({ url: data.authorization_url });
}
