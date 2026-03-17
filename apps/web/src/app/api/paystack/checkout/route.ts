import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';

const PLAN_CODES: Record<string, string> = {
  creator: process.env.NEXT_PUBLIC_PAYSTACK_CREATOR_PLAN_CODE!,
};

// Amounts in kobo (₦1 = 100 kobo)
const PLAN_AMOUNTS: Record<string, number> = {
  creator: 500000, // ₦5,000
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tier, returnUrl } = (await request.json()) as {
    tier: string;
    returnUrl: string;
  };

  const planCode = PLAN_CODES[tier];
  if (!planCode) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  if (!email) {
    return NextResponse.json({ error: 'No email on account' }, { status: 400 });
  }

  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: PLAN_AMOUNTS[tier],
      plan: planCode,
      callback_url: `${returnUrl}?upgrade=paystack-success`,
      metadata: { tokenIdentifier: userId },
    }),
  });

  if (!paystackRes.ok) {
    const err = (await paystackRes.json()) as { message: string };
    console.error('[Paystack error]', paystackRes.status, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const { data } = (await paystackRes.json()) as { data: { authorization_url: string } };
  return NextResponse.json({ url: data.authorization_url });
}
