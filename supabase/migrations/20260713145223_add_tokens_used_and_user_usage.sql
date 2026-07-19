alter table agents add column tokens_used integer default 0;

create table user_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  plan text default 'free',
  monthly_messages_used integer default 0,
  monthly_reset_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);
