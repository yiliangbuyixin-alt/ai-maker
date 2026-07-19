import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Plan } from "@/lib/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Reads the caller's plan from user_usage, creating a default "free" row
// on first sight of a user. The client-supplied `plan` is never trusted —
// this is the sole source of truth for which plan a request runs at.
export async function getUserPlan(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<Plan> {
  const { data } = await supabase
    .from("user_usage")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();

  if (data?.plan) return data.plan as Plan;

  // Race-safe best effort: if another concurrent request already created
  // this row, the insert fails on the unique constraint and is ignored —
  // either way the caller still gets the correct default for this request.
  await supabase.from("user_usage").insert({ user_id: userId });
  return "free";
}
