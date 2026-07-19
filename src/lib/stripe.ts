import "server-only";
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export type PaidPlan = "pro" | "business";

// JPY is a zero-decimal currency in Stripe — 1980 means ¥1,980, not
// ¥19.80 — so these amounts are used as-is in unit_amount.
export const PLAN_PRICES: Record<PaidPlan, { amount: number; label: string }> = {
  pro: { amount: 1980, label: "Pro プラン" },
  business: { amount: 9800, label: "Business プラン" },
};
