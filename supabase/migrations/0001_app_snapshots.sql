-- AdLab Simulator: опційне хмарне збереження навчального прогресу.
-- Один знімок стану застосунку на користувача (Supabase Auth).

create table if not exists public.app_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  schema_version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.app_snapshots enable row level security;

create policy "Users read own snapshot"
  on public.app_snapshots for select
  using (auth.uid() = user_id);

create policy "Users insert own snapshot"
  on public.app_snapshots for insert
  with check (auth.uid() = user_id);

create policy "Users update own snapshot"
  on public.app_snapshots for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own snapshot"
  on public.app_snapshots for delete
  using (auth.uid() = user_id);
