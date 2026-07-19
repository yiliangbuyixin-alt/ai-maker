import Anthropic from "@anthropic-ai/sdk";
import type { Plan } from "@/lib/types";

export const anthropic = new Anthropic();

export function modelForPlan(plan: Plan): string {
  return plan === "free" ? "claude-haiku-4-5" : "claude-sonnet-5";
}

// claude-sonnet-5 runs adaptive thinking by default when `thinking` is
// omitted, which can consume the entire max_tokens budget on short,
// low-reasoning turns like these and leave no room for the reply text.
// This app only needs single-turn Q&A / extraction, so thinking is
// disabled for it. (claude-haiku-4-5 has no thinking-by-default
// behavior, so it's left as-is.)
export function thinkingConfigForPlan(plan: Plan): Anthropic.ThinkingConfigParam | undefined {
  return plan === "free" ? undefined : { type: "disabled" };
}
