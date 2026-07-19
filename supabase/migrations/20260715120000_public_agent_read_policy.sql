-- Allow anyone (anonymous or authenticated) to read an agent once its
-- owner has published it, so the public chat page at /a/[id] can render
-- and run without a login. This is additive: Postgres OR's multiple
-- permissive policies, so owner-only visibility for non-published rows
-- (see 20260714141431_agents_user_usage_rls.sql) is unaffected.
create policy "Anyone can view published agents"
  on public.agents for select
  to anon, authenticated
  using (status = 'published');
