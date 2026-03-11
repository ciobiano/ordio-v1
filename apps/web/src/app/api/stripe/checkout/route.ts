import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@clerk/nextjs/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PRICE_IDS: Record<string, string> = {
  creator: process.env.NEXT_PUBLIC_STRIPE_CREATOR_PRICE_ID!,
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

  const priceId = PRICE_IDS[tier];
  if (!priceId) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
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
