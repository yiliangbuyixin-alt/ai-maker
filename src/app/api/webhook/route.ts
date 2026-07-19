import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

function isPaidPlan(value: unknown): value is "pro" | "business" {
  return value === "pro" || value === "business";
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return Response.json({ error: "webhook is not configured" }, { status: 500 });
  }

  // Must read the raw body (not request.json()) — Stripe's signature is
  // computed over the exact bytes it sent, and any re-serialization would
  // invalidate it.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    return Response.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const plan = session.metadata?.plan;

      if (userId && isPaidPlan(plan)) {
        await supabaseAdmin.from("user_usage").upsert({ user_id: userId, plan }, { onConflict: "user_id" });
      }
      break;
    }

    // Subscription lapses (cancelled, or payment ultimately failed) — drop
    // the user back to the free plan rather than leaving them upgraded
    // forever with nothing being billed.
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.user_id;

      if (userId) {
        await supabaseAdmin
          .from("user_usage")
          .upsert({ user_id: userId, plan: "free" }, { onConflict: "user_id" });
      }
      break;
    }

    default:
      break;
  }

  return Response.json({ received: true });
}
