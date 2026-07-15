-- ============================================================================
-- 0010_time_entries.sql
--
-- hourly_rate_pence is snapshotted onto the row at start time rather than
-- looked up from a client/profile rate at invoicing time — a freelancer's
-- rate can change, and a time entry should always bill at the rate that
-- was in effect when the work happened, not whatever the rate is today.
-- ============================================================================

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  description text not null default '',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  hourly_rate_pence bigint not null default 0 check (hourly_rate_pence >= 0),
  is_billable boolean not null default true,
  created_at timestamptz not null default now(),
  constraint time_entries_ended_after_started check (ended_at is null or ended_at >= started_at)
);

create index if not exists time_entries_user_id_idx on public.time_entries(user_id);
create index if not exists time_entries_client_id_idx on public.time_entries(client_id);
create index if not exists time_entries_unbilled_idx on public.time_entries(user_id, client_id)
  where is_billable = true and invoice_id is null and ended_at is not null;

-- At most one running timer per freelancer — a plain partial unique index
-- enforces this at the database level rather than trusting the UI to
-- prevent a second "start" click.
create unique index if not exists time_entries_one_running_per_user
  on public.time_entries(user_id) where ended_at is null;

alter table public.time_entries enable row level security;

create policy "time_entries_select_own" on public.time_entries
  for select using (auth.uid() = user_id);
create policy "time_entries_insert_own" on public.time_entries
  for insert with check (auth.uid() = user_id);
create policy "time_entries_update_own" on public.time_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "time_entries_delete_own" on public.time_entries
  for delete using (auth.uid() = user_id);
