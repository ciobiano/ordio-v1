import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const PLAN_CODES: Record<string, string> = {
  creator: process.env.NEXT_PUBLIC_PAYSTACK_CREATOR_PLAN_CODE!,
};

export async function POST(request: Request) {
  const { userId, sessionClaims } = await auth();
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

  const email = sessionClaims?.email as string | undefined;
  if (!email) {
    return NextResponse.json({ error: 'No email on Clerk session' }, { status: 400 });
  }

  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      plan: planCode,
      callback_url: `${returnUrl}?upgrade=paystack-success`,
      metadata: { tokenIdentifier: userId },
    }),
  });

  if (!paystackRes.ok) {
    const err = (await paystackRes.json()) as { message: string };
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const { data } = (await paystackRes.json()) as { data: { authorization_url: string } };
  return NextResponse.json({ url: data.authorization_url });
}
