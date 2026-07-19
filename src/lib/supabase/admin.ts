import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS entirely. Only ever import this from
// server-only code that itself authenticates the caller by other means
// (here, a verified Stripe webhook signature) — never from a route that
// trusts an ordinary user session or the anon key's request context.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
