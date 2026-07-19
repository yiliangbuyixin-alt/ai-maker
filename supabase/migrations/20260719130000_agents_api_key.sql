-- API keys let a Pro/Business agent be called from /api/v1/chat without a
-- login. Only the SHA-256 hash of the key is ever stored — the plaintext
-- key is generated, shown once to the owner, and discarded (see
-- /api/agents/[id]/api-key). Lookup by hash at call time goes through the
-- service-role client (src/lib/supabase/admin.ts), not RLS: a policy
-- permissive enough to let anon read agents by api_key match would let
-- anyone enumerate every issued key's hash and system_prompt directly via
-- PostgREST, without ever presenting the real key.
alter table public.agents add column api_key text unique;
