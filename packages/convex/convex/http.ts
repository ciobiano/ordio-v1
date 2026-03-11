import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// ─── Signature Helpers ────────────────────────────────────────────────────────

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

// ─── Existing Route ───────────────────────────────────────────────────────────

/**
 * Webhook for the renderer to update job status.
 * e.g. POST /updateStatus { jobId, status, renderedVideoId }
 */
http.route({
  path: "/updateStatus",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const { jobId, status, renderedVideoId, error } = await request.json();

    if (!jobId || !status) {
      return new Response("Missing jobId or status", { status: 400 });
    }

    console.log(`Received status update for ${jobId}: ${status}`);

    return new Response(null, { status: 200 });
  }),
});

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
        }
      }
    }

    return new Response(null, { status: 200 });
  }),
});

export default http;
