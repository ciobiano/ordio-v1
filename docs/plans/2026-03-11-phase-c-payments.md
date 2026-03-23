# Phase C: Stripe + Paystack Subscription Payments

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire real subscription checkout (Stripe for international users, Paystack for Nigerian users) so the UpgradeSheet "Upgrade to Creator" CTA sends users through a hosted payment page and, after payment, Convex automatically promotes their tier to `'creator'`.

**Architecture:** Two hosted-checkout flows (Stripe/Paystack) are triggered from a single `useCheckout` hook that detects the user's timezone to pick the right processor. Webhooks from each processor hit Convex HTTP actions that verify signatures and call a shared `setTier` internal mutation. Since we use Convex realtime, `useCurrentUser()` reacts instantly when the tier changes — no polling needed.

**Tech Stack:** `stripe` npm SDK (server-only), Paystack REST API via `fetch` (server-only), Convex HTTP actions, Next.js App Router API routes, Clerk `auth()` for server-side user ID.

---

## Pre-requisites (do before Task 1)

1. Create a free Stripe account → Dashboard → Products → Create product "Ordio Creator" → Add monthly price $9/mo → copy `price_...` ID
2. Create a free Paystack account → Plans → Create plan "Ordio Creator" NGN 5000/mo → copy `PLN_...` code
3. Have both dashboard webhook secret keys ready (generated in Tasks 4 + 6)

---

## Environment Variables Reference

```bash
# .env.local (apps/web)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_CREATOR_PRICE_ID=price_...

PAYSTACK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_PAYSTACK_CREATOR_PLAN_CODE=PLN_...

# packages/convex — add to Convex dashboard environment variables
STRIPE_WEBHOOK_SECRET=whsec_...
PAYSTACK_SECRET_KEY=sk_test_...
```

---

### Task 1: Convex Schema Migration — Add Subscription Fields

**Files:**
- Modify: `packages/convex/convex/schema.ts`

**Step 1: Add subscription fields to the users table**

```ts
// In schema.ts, update the users defineTable() call:
users: defineTable({
  tokenIdentifier: v.string(),
  tier: v.union(v.literal('free'), v.literal('creator'), v.literal('pro')),
  usageCount: v.number(),
  lastResetTime: v.number(),
  // NEW — subscription tracking
  stripeCustomerId: v.optional(v.string()),
  paystackCustomerCode: v.optional(v.string()),
  subscriptionId: v.optional(v.string()),
  subscriptionStatus: v.optional(
    v.union(v.literal('active'), v.literal('canceled'), v.literal('past_due'))
  ),
})
.index("by_token", ["tokenIdentifier"])
.index("by_stripe_customer", ["stripeCustomerId"])
.index("by_paystack_customer", ["paystackCustomerCode"])
```

**Step 2: Deploy schema**

```bash
cd packages/convex
npx convex dev
```

Expected: `Schema updated` in terminal. No errors. Existing user documents remain valid (all new fields are `v.optional`).

**Step 3: Commit**

```bash
git add packages/convex/convex/schema.ts
git commit -m "feat(convex): add subscription fields to users schema"
```

---

### Task 2: Convex Internal Mutations — setTier + setCustomerId

**Files:**
- Modify: `packages/convex/convex/users.ts`

**Step 1: Add `setTier` internalMutation**

Append to `users.ts`:

```ts
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * INTERNAL: Called by webhook HTTP actions to promote/downgrade a user's tier.
 * Looks up by tokenIdentifier (Clerk ID stored in payment metadata).
 */
export const setTier = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    tier: v.union(v.literal('free'), v.literal('creator'), v.literal('pro')),
    subscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(
      v.union(v.literal('active'), v.literal('canceled'), v.literal('past_due'))
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .unique();

    if (!user) {
      // User hasn't signed in yet — insert with upgraded tier
      await ctx.db.insert("users", {
        tokenIdentifier: args.tokenIdentifier,
        tier: args.tier,
        usageCount: 0,
        lastResetTime: Date.now(),
        subscriptionId: args.subscriptionId,
        subscriptionStatus: args.subscriptionStatus,
      });
      return;
    }

    await ctx.db.patch(user._id, {
      tier: args.tier,
      subscriptionId: args.subscriptionId,
      subscriptionStatus: args.subscriptionStatus,
    });
  },
});

/**
 * INTERNAL: Store the payment provider's customer ID after first checkout.
 * Needed to manage subscription cancellations later.
 */
export const setCustomerId = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    stripeCustomerId: v.optional(v.string()),
    paystackCustomerCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .unique();

    if (!user) return;

    await ctx.db.patch(user._id, {
      stripeCustomerId: args.stripeCustomerId,
      paystackCustomerCode: args.paystackCustomerCode,
    });
  },
});
```

**Step 2: Deploy**

```bash
cd packages/convex && npx convex dev
```

Expected: Functions deployed, no type errors.

**Step 3: Commit**

```bash
git add packages/convex/convex/users.ts
git commit -m "feat(convex): add setTier + setCustomerId internal mutations"
```

---

### Task 3: Convex HTTP Webhook Routes — Stripe + Paystack

**Files:**
- Modify: `packages/convex/convex/http.ts`

**Step 1: Add Stripe webhook route**

Append to `http.ts` before `export default http`:

```ts
http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const sig = request.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return new Response("Missing signature or secret", { status: 400 });
    }

    const body = await request.text();

    // Verify Stripe signature using Web Crypto (no Node crypto in Convex runtime)
    const isValid = await verifyStripeSignature(body, sig, webhookSecret);
    if (!isValid) {
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(body);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const tokenIdentifier = session.metadata?.tokenIdentifier;
      if (!tokenIdentifier) return new Response("No tokenIdentifier in metadata", { status: 400 });

      await ctx.runMutation(internal.users.setTier, {
        tokenIdentifier,
        tier: "creator",
        subscriptionId: session.subscription,
        subscriptionStatus: "active",
      });

      await ctx.runMutation(internal.users.setCustomerId, {
        tokenIdentifier,
        stripeCustomerId: session.customer,
      });
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const customer = sub.customer;
      const user = await ctx.runQuery(internal.users.getByStripeCustomerId, { stripeCustomerId: customer });
      if (user) {
        await ctx.runMutation(internal.users.setTier, {
          tokenIdentifier: user.tokenIdentifier,
          tier: "free",
          subscriptionId: sub.id,
          subscriptionStatus: "canceled",
        });
      }
    }

    return new Response(null, { status: 200 });
  }),
});
```

**Step 2: Add Paystack webhook route**

```ts
http.route({
  path: "/paystack-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const sig = request.headers.get("x-paystack-signature");
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!sig || !secretKey) {
      return new Response("Missing signature or secret", { status: 400 });
    }

    const body = await request.text();

    // Verify Paystack HMAC-SHA512 signature
    const isValid = await verifyPaystackSignature(body, sig, secretKey);
    if (!isValid) {
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(body);

    if (event.event === "subscription.create") {
      const sub = event.data;
      const tokenIdentifier = sub.metadata?.tokenIdentifier;
      if (!tokenIdentifier) return new Response("No tokenIdentifier", { status: 400 });

      await ctx.runMutation(internal.users.setTier, {
        tokenIdentifier,
        tier: "creator",
        subscriptionId: sub.subscription_code,
        subscriptionStatus: "active",
      });

      await ctx.runMutation(internal.users.setCustomerId, {
        tokenIdentifier,
        paystackCustomerCode: sub.customer?.customer_code,
      });
    }

    if (event.event === "subscription.disable") {
      const sub = event.data;
      const customerCode = sub.customer?.customer_code;
      const user = await ctx.runQuery(internal.users.getByPaystackCustomer, { paystackCustomerCode: customerCode });
      if (user) {
        await ctx.runMutation(internal.users.setTier, {
          tokenIdentifier: user.tokenIdentifier,
          tier: "free",
          subscriptionId: sub.subscription_code,
          subscriptionStatus: "canceled",
        });
      }
    }

    return new Response(null, { status: 200 });
  }),
});
```

**Step 3: Add signature verification helpers + internal query**

Add these above the `http.route(...)` calls:

```ts
// In http.ts, above the routes:

async function verifyStripeSignature(
  body: string,
  sig: string,
  secret: string
): Promise<boolean> {
  try {
    const parts = sig.split(",").reduce<Record<string, string>>((acc, part) => {
      const [k, v] = part.split("=");
      acc[k] = v;
      return acc;
    }, {});
    const timestamp = parts["t"];
    const expectedSig = parts["v1"];
    if (!timestamp || !expectedSig) return false;

    const payload = `${timestamp}.${body}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const computed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    const hex = Array.from(new Uint8Array(computed))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hex === expectedSig;
  } catch {
    return false;
  }
}

async function verifyPaystackSignature(
  body: string,
  sig: string,
  secret: string
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );
    const computed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    const hex = Array.from(new Uint8Array(computed))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hex === sig;
  } catch {
    return false;
  }
}
```

**Step 4: Add `getByStripeCustomerId` and `getByPaystackCustomer` internal queries to `users.ts`**

```ts
export const getByStripeCustomerId = internalQuery({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("users")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .unique();
  },
});

export const getByPaystackCustomer = internalQuery({
  args: { paystackCustomerCode: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("users")
      .withIndex("by_paystack_customer", (q) => q.eq("paystackCustomerCode", args.paystackCustomerCode))
      .unique();
  },
});
```

Also add `internalQuery` to the import line in `users.ts`:
```ts
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
```

**Step 5: Deploy and verify**

```bash
cd packages/convex && npx convex dev
```

Expected: All functions deployed. HTTP routes registered at `/stripe-webhook` and `/paystack-webhook`.

**Step 6: Commit**

```bash
git add packages/convex/convex/http.ts packages/convex/convex/users.ts
git commit -m "feat(convex): add Stripe + Paystack webhook HTTP actions"
```

---

### Task 4: Stripe Checkout API Route

**Files:**
- Create: `apps/web/src/app/api/stripe/checkout/route.ts`

**Step 1: Install Stripe SDK**

```bash
pnpm add stripe --filter=web
```

**Step 2: Create the route**

```ts
// apps/web/src/app/api/stripe/checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@clerk/nextjs/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' });

const PRICE_IDS: Record<string, string> = {
  creator: process.env.NEXT_PUBLIC_STRIPE_CREATOR_PRICE_ID!,
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tier, returnUrl } = await request.json() as { tier: string; returnUrl: string };
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
```

**Step 3: Verify manually**

Start dev server, open browser console and run:
```js
fetch('/api/stripe/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tier: 'creator', returnUrl: window.location.href })
}).then(r => r.json()).then(console.log)
```

Expected if not signed in: `{ error: 'Unauthorized' }`.
Expected if signed in: `{ url: 'https://checkout.stripe.com/...' }`.

**Step 4: Commit**

```bash
git add apps/web/src/app/api/stripe/checkout/route.ts
git commit -m "feat(web): add Stripe checkout session API route"
```

---

### Task 5: Paystack Checkout API Route

**Files:**
- Create: `apps/web/src/app/api/paystack/checkout/route.ts`

No npm package needed — use direct Paystack REST API.

**Step 1: Create the route**

```ts
// apps/web/src/app/api/paystack/checkout/route.ts
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

  const { tier, returnUrl } = await request.json() as { tier: string; returnUrl: string };
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
    const err = await paystackRes.json();
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const { data } = await paystackRes.json();
  return NextResponse.json({ url: data.authorization_url });
}
```

**Step 2: Verify manually** (same as Task 4 Step 3, call `/api/paystack/checkout`)

Expected if signed in and `PAYSTACK_SECRET_KEY` set: `{ url: 'https://paystack.com/pay/...' }`.

**Step 3: Commit**

```bash
git add apps/web/src/app/api/paystack/checkout/route.ts
git commit -m "feat(web): add Paystack checkout API route"
```

---

### Task 6: useCheckout Hook + Success Toast

**Files:**
- Create: `apps/web/src/hooks/useCheckout.ts`
- Modify: `apps/web/src/app/page.tsx`

**Step 1: Create useCheckout hook**

```ts
// apps/web/src/hooks/useCheckout.ts
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

    const { url } = await res.json() as { url: string };
    window.location.href = url;
  }, []);

  return { startCheckout };
}
```

**Step 2: Handle success redirect in page.tsx**

In `page.tsx`, add to the existing imports:
```ts
import { useSearchParams, useRouter } from 'next/navigation';
```

Add after existing hooks:
```ts
const searchParams = useSearchParams();
const router = useRouter();

useEffect(() => {
  const upgrade = searchParams.get('upgrade');
  if (upgrade === 'stripe-success' || upgrade === 'paystack-success') {
    toast.success('Payment received! Your account is being upgraded…');
    router.replace('/');
  }
}, [searchParams, router]);
```

**Step 3: Commit**

```bash
git add apps/web/src/hooks/useCheckout.ts apps/web/src/app/page.tsx
git commit -m "feat(web): add useCheckout hook + post-payment success toast"
```

---

### Task 7: Wire Real CTAs in UpgradeSheet

**Files:**
- Modify: `apps/web/src/components/soul/UpgradeSheet.tsx`

**Step 1: Add `onUpgrade` prop**

Change the props interface:
```ts
interface UpgradeSheetProps {
  open: boolean;
  onClose: () => void;
  feature?: FeatureKey;
  onSignIn?: () => void;
  onUpgrade?: () => void;  // NEW
}
```

Update the component signature to accept `onUpgrade`:
```ts
export default function UpgradeSheet({ open, onClose, feature, onUpgrade }: UpgradeSheetProps) {
```

**Step 2: Replace "Coming soon" button with real upgrade button**

Find the section that renders the authenticated CTA. Replace the placeholder with:
```tsx
{isAuthenticated && (
  <button
    onClick={() => { onClose(); onUpgrade?.(); }}
    className="w-full py-3 rounded-full bg-white text-black text-[0.875rem] font-[600]
               hover:bg-white/92 transition-all duration-200 cursor-pointer
               hover:scale-[1.02] active:scale-[0.98]"
  >
    Upgrade to Creator — $9/mo
  </button>
)}
```

**Step 3: Pass onUpgrade from page.tsx**

In `page.tsx`, add to imports:
```ts
import { useCheckout } from '@/hooks/useCheckout';
```

Add hook:
```ts
const { startCheckout } = useCheckout();
```

Update UpgradeSheet in JSX:
```tsx
<UpgradeSheet
  open={upgradeTarget !== null}
  onClose={() => setUpgradeTarget(null)}
  feature={upgradeTarget === 'export_limit' ? undefined : upgradeTarget ?? undefined}
  onUpgrade={() => startCheckout('creator').catch(() => toast.error('Checkout failed. Try again.'))}
/>
```

**Step 4: Verify in browser**

1. Click any locked feature → UpgradeSheet opens
2. If authenticated: "Upgrade to Creator — $9/mo" button appears
3. Click → redirects to Stripe (or Paystack if `Africa/Lagos` timezone)

**Step 5: Commit**

```bash
git add apps/web/src/components/soul/UpgradeSheet.tsx apps/web/src/app/page.tsx
git commit -m "feat(web): wire real Stripe/Paystack checkout to UpgradeSheet CTA"
```

---

### Task 8: Register Webhooks in Stripe + Paystack Dashboards

**Stripe:**
1. Get your Convex deployment URL: `npx convex dev` shows it as `https://<project>.convex.cloud`
2. Stripe Dashboard → Developers → Webhooks → Add endpoint
3. URL: `https://<project>.convex.cloud/stripe-webhook`
4. Events to listen for: `checkout.session.completed`, `customer.subscription.deleted`
5. Copy the `whsec_...` signing secret → add to Convex dashboard env vars as `STRIPE_WEBHOOK_SECRET`

**Paystack:**
1. Paystack Dashboard → Settings → API Keys & Webhooks
2. Webhook URL: `https://<project>.convex.cloud/paystack-webhook`
3. The HMAC secret for Paystack is your `PAYSTACK_SECRET_KEY` itself (Paystack uses it to sign webhooks)
4. Add `PAYSTACK_SECRET_KEY` to Convex dashboard env vars

**Step 1: Test Stripe webhook with CLI**

```bash
# Install Stripe CLI if not present: brew install stripe/stripe-cli/stripe
stripe listen --forward-to https://<project>.convex.cloud/stripe-webhook
```

Then trigger a test event:
```bash
stripe trigger checkout.session.completed
```

Expected: Convex dashboard logs show the event received, no errors.

**Step 2: Commit env var documentation**

```bash
# Create .env.example at monorepo root if it doesn't exist
cat >> .env.example << 'EOF'

# Phase C — Payments
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_CREATOR_PRICE_ID=price_...
PAYSTACK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_PAYSTACK_CREATOR_PLAN_CODE=PLN_...
EOF

git add .env.example
git commit -m "docs: add Phase C payment env vars to .env.example"
```

---

### Task 9: End-to-End Test with Stripe Test Mode

**Goal:** Verify the full flow before going live.

**Step 1: Set test env vars in `.env.local`**

Use Stripe test keys (`sk_test_...`) and Paystack test keys.

**Step 2: Run full flow**

1. `pnpm dev --filter=web` + `npx convex dev` (in separate terminals)
2. Sign in to the app
3. Click a locked feature → UpgradeSheet opens → "Upgrade to Creator" button visible
4. Click → redirected to Stripe Checkout (test mode)
5. Enter test card `4242 4242 4242 4242`, any future date, any CVC
6. Complete payment → redirected back to app → toast "Payment received! Your account is being upgraded…"
7. Within ~5 seconds: locked features unlock (Convex realtime propagates tier change)

**Step 3: Verify Convex dashboard**

Open Convex dashboard → Data → users table → your user record should show:
- `tier: "creator"`
- `subscriptionStatus: "active"`
- `stripeCustomerId: "cus_..."`

**Step 4: Test cancellation**

In Stripe dashboard test mode: cancel the subscription.
Webhook fires `customer.subscription.deleted` → Convex sets `tier: "free"` → locks re-appear.

**Step 5: Run existing tests**

```bash
pnpm test --filter=web
pnpm type-check
```

Expected: All 20 tests pass, no type errors.

**Step 6: Final commit**

```bash
git add -A
git commit -m "chore: verify Phase C payments end-to-end"
```

---

## Critical Files Summary

| File | Role |
|------|------|
| `packages/convex/convex/schema.ts` | Schema migration — subscription fields |
| `packages/convex/convex/users.ts` | `setTier`, `setCustomerId`, `getByStripeCustomerId`, `getByPaystackCustomer` |
| `packages/convex/convex/http.ts` | Webhook HTTP actions — verify signatures, call setTier |
| `apps/web/src/app/api/stripe/checkout/route.ts` | Creates Stripe Checkout Session |
| `apps/web/src/app/api/paystack/checkout/route.ts` | Initializes Paystack transaction |
| `apps/web/src/hooks/useCheckout.ts` | Market detection + checkout redirect |
| `apps/web/src/components/soul/UpgradeSheet.tsx` | Real CTA button (replaces "Coming soon") |
| `apps/web/src/app/page.tsx` | Wires useCheckout, success toast, passes onUpgrade |

## Verification Checklist

- [ ] `npx convex dev` — schema deploys, no errors
- [ ] `/api/stripe/checkout` returns `{ url }` for signed-in user
- [ ] `/api/paystack/checkout` returns `{ url }` for signed-in user
- [ ] Stripe test checkout completes → tier upgrades in Convex within 5s
- [ ] Locked features unlock after tier upgrade (no page refresh needed)
- [ ] Subscription cancel → tier reverts to free
- [ ] `pnpm test --filter=web` — 20 tests pass
- [ ] `pnpm type-check` — clean
