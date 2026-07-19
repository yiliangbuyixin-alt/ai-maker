import { createClient } from "@/lib/supabase/server";
import { stripe, PLAN_PRICES, type PaidPlan } from "@/lib/stripe";

function isPaidPlan(value: unknown): value is PaidPlan {
  return value === "pro" || value === "business";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return Response.json({ error: "ログインが必要です" }, { status: 401 });
  }

  let body: { plan?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!isPaidPlan(body.plan)) {
    return Response.json({ error: "plan must be 'pro' or 'business'" }, { status: 400 });
  }

  const plan = body.plan;
  const { amount, label } = PLAN_PRICES[plan];
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    locale: "ja",
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: "jpy",
          unit_amount: amount,
          recurring: { interval: "month" },
          product_data: { name: label },
        },
        quantity: 1,
      },
    ],
    // The webhook has no logged-in session to work with (Stripe calls it
    // server-to-server), so it relies entirely on this metadata to know
    // which user_usage row to update.
    metadata: { user_id: user.id, plan },
    subscription_data: { metadata: { user_id: user.id, plan } },
    success_url: `${origin}/interview?upgraded=${plan}`,
    cancel_url: `${origin}/interview`,
  });

  if (!session.url) {
    return Response.json({ error: "Checkoutセッションの作成に失敗しました" }, { status: 502 });
  }

  return Response.json({ url: session.url });
}
