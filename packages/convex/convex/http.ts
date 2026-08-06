import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// ─── Signature Helpers ────────────────────────────────────────────────────────

async function computeHmac(
  payload: string,
  secret: string,
  algorithm: "SHA-256" | "SHA-512"
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"]
  );
  const computed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(computed))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compare two hex digests without leaking their divergence point through
 * timing. `===` on strings can short-circuit at the first differing byte; this
 * always walks the full width. Length is compared first because it is not
 * secret — only the contents are.
 */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyStripeSignature(
  body: string,
  signatureHeader: string,
  secret: string
): Promise<boolean> {
  try {
    const parts = signatureHeader.split(",").reduce<Record<string, string>>((acc, part) => {
      const [key, value] = part.split("=");
      acc[key] = value;
      return acc;
    }, {});
    const timestamp = parts["t"];
    const expectedHex = parts["v1"];
    if (!timestamp || !expectedHex) return false;

    const hex = await computeHmac(`${timestamp}.${body}`, secret, "SHA-256");
    return timingSafeEqualHex(hex, expectedHex);
  } catch {
    return false;
  }
}

async function verifyPaystackSignature(
  body: string,
  signatureHeader: string,
  secret: string
): Promise<boolean> {
  try {
    const hex = await computeHmac(body, secret, "SHA-512");
    return timingSafeEqualHex(hex, signatureHeader);
  } catch {
    return false;
  }
}

// `/updateStatus` used to live here: an unauthenticated public POST route for a
// renderer that no longer exists. It verified no signature, wrote nothing, and
// only logged its input — a free, internet-reachable way to write attacker text
// into our logs. Removed rather than secured; there is nothing left to secure.

// ─── Stripe Webhook ───────────────────────────────────────────────────────────

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
    const isValid = await verifyStripeSignature(body, sig, webhookSecret);
    if (!isValid) {
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(body);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const tokenIdentifier = session.metadata?.tokenIdentifier as string | undefined;
      if (!tokenIdentifier) {
        return new Response("No tokenIdentifier in metadata", { status: 400 });
      }

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

      // The processor that took the money decides the allowance — never the
      // client, which infers its market from the device timezone.
      await ctx.runMutation(internal.credits.setMonthlyAllowance, {
        tokenIdentifier,
        processor: "stripe",
      });
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const user = await ctx.runQuery(internal.users.getByStripeCustomerId, {
        stripeCustomerId: sub.customer,
      });
      if (user) {
        await ctx.runMutation(internal.users.setTier, {
          tokenIdentifier: user.tokenIdentifier,
          tier: "free",
          subscriptionId: sub.id,
          subscriptionStatus: "canceled",
        });

        // Stops future refills. Their remaining balance stays theirs — they
        // paid for this month, and cancelling should not confiscate it.
        await ctx.runMutation(internal.credits.clearMonthlyAllowance, {
          tokenIdentifier: user.tokenIdentifier,
        });
      }
    }

    return new Response(null, { status: 200 });
  }),
});

// ─── Paystack Webhook ─────────────────────────────────────────────────────────

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
    const isValid = await verifyPaystackSignature(body, sig, secretKey);
    if (!isValid) {
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(body);

    // charge.success fires on initial subscription payment and carries metadata
    // subscription.create metadata is empty — don't use it for tier promotion
    if (event.event === "charge.success") {
      const charge = event.data;
      // Only handle subscription charges (charges linked to a plan)
      if (!charge.plan) return new Response(null, { status: 200 });

      const tokenIdentifier = charge.metadata?.tokenIdentifier as string | undefined;
      if (!tokenIdentifier) {
        return new Response("No tokenIdentifier in charge metadata", { status: 400 });
      }

      await ctx.runMutation(internal.users.setTier, {
        tokenIdentifier,
        tier: "creator",
        subscriptionId: charge.subscription_code ?? charge.reference,
        subscriptionStatus: "active",
      });

      await ctx.runMutation(internal.users.setCustomerId, {
        tokenIdentifier,
        paystackCustomerCode: charge.customer?.customer_code,
      });

      // ₦999 buys a smaller allowance than $9.99 — see shared/src/credits.ts.
      await ctx.runMutation(internal.credits.setMonthlyAllowance, {
        tokenIdentifier,
        processor: "paystack",
      });
    }

    if (event.event === "subscription.disable") {
      const sub = event.data;
      const customerCode = sub.customer?.customer_code as string | undefined;
      if (customerCode) {
        const user = await ctx.runQuery(internal.users.getByPaystackCustomer, {
          paystackCustomerCode: customerCode,
        });
        if (user) {
          await ctx.runMutation(internal.users.setTier, {
            tokenIdentifier: user.tokenIdentifier,
            tier: "free",
            subscriptionId: sub.subscription_code,
            subscriptionStatus: "canceled",
          });

          // As above: stop refilling, but leave the paid-for balance alone.
          await ctx.runMutation(internal.credits.clearMonthlyAllowance, {
            tokenIdentifier: user.tokenIdentifier,
          });
        }
      }
    }

    return new Response(null, { status: 200 });
  }),
});

export default http;
