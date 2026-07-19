-- Restrict `agents` and `user_usage` to per-row ownership (user_id = auth.uid()).
-- Anonymous (anon key, unauthenticated) requests get no access at all: RLS
-- default-denies once enabled, and every policy below is scoped `to authenticated`.

-- Drop any existing policies on these tables first, regardless of name, so a
-- stale permissive policy can't coexist with (and silently defeat) the
-- restrictive ones created here — Postgres OR's multiple permissive policies.
do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'agents' loop
    execute format('drop policy if exists %I on public.agents', pol.policyname);
  end loop;
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'user_usage' loop
    execute format('drop policy if exists %I on public.user_usage', pol.policyname);
  end loop;
end $$;

alter table public.agents enable row level security;
alter table public.user_usage enable row level security;

create policy "Users can view their own agents"
  on public.agents for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own agents"
  on public.agents for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own agents"
  on public.agents for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own agents"
  on public.agents for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can view their own usage"
  on public.user_usage for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own usage"
  on public.user_usage for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own usage"
  on public.user_usage for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own usage"
  on public.user_usage for delete
  to authenticated
  using (auth.uid() = user_id);
