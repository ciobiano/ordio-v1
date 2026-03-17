import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@clerk/nextjs/server';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getPriceIds(): Record<string, string> {
  return {
    creator: process.env.NEXT_PUBLIC_STRIPE_CREATOR_PRICE_ID!,
  };
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tier, returnUrl } = (await request.json()) as {
    tier: string;
    returnUrl: string;
  };

  const priceId = getPriceIds()[tier];
  if (!priceId) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${returnUrl}?upgrade=stripe-success`,
    cancel_url: `${returnUrl}?upgrade=canceled`,
    metadata: { tokenIdentifier: userId },
    subscription_data: {
      metadata: { tokenIdentifier: userId },
    },
  });

  return NextResponse.json({ url: session.url });
}
