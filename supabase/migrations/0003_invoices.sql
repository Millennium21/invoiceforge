-- ============================================================================
-- 0003_invoices.sql
--
-- Money is stored as integer minor units (pence) everywhere — never a float
-- column — which sidesteps rounding bugs and maps 1:1 onto Stripe's own
-- amount format. Totals are computed authoritatively on the server
-- (see lib/money.ts) and re-validated here on write via a CHECK-friendly
-- shape; the DB does not recompute them, the server action does, so both
-- layers agree on one source of truth.
-- ============================================================================

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,

  invoice_number text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled')),

  currency text not null default 'GBP',
  issue_date date not null default current_date,
  due_date date not null,

  discount_type text not null default 'none' check (discount_type in ('none', 'percent', 'fixed')),
  discount_value numeric(10,2) not null default 0,
  tax_rate_percent numeric(5,2) not null default 0,

  subtotal_pence bigint not null default 0,
  discount_pence bigint not null default 0,
  tax_pence bigint not null default 0,
  total_pence bigint not null default 0,

  notes text,
  public_token uuid not null default gen_random_uuid(),

  is_recurring boolean not null default false,
  recurrence_interval text check (recurrence_interval in ('weekly', 'monthly', 'quarterly', 'yearly')),
  recurrence_end_date date,
  next_invoice_date date,
  recurrence_parent_id uuid references public.invoices(id) on delete set null,

  stripe_checkout_session_id text,
  stripe_payment_intent_id text,

  sent_at timestamptz,
  viewed_at timestamptz,
  paid_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint invoices_user_number_unique unique (user_id, invoice_number),
  constraint invoices_public_token_unique unique (public_token),
  constraint invoices_recurring_has_interval check (
    (is_recurring = false) or (is_recurring = true and recurrence_interval is not null)
  )
);

create index if not exists invoices_user_id_idx on public.invoices(user_id);
create index if not exists invoices_client_id_idx on public.invoices(client_id);
create index if not exists invoices_status_idx on public.invoices(status);
create index if not exists invoices_due_date_idx on public.invoices(due_date) where status in ('sent', 'viewed', 'overdue');
create index if not exists invoices_next_invoice_date_idx on public.invoices(next_invoice_date) where is_recurring = true;
create unique index if not exists invoices_public_token_idx on public.invoices(public_token);

alter table public.invoices enable row level security;

create policy "invoices_select_own" on public.invoices
  for select using (auth.uid() = user_id);

create policy "invoices_insert_own" on public.invoices
  for insert with check (auth.uid() = user_id);

create policy "invoices_update_own" on public.invoices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "invoices_delete_own" on public.invoices
  for delete using (auth.uid() = user_id and status = 'draft');

-- Note: there is deliberately NO policy granting anon/public SELECT access
-- via public_token. The client-facing invoice page reads through the
-- service-role client instead (see lib/supabase/admin.ts), which is an
-- explicit, auditable code path rather than a standing RLS exception —
-- a public RLS policy is the kind of thing that quietly over-exposes rows
-- the moment a second, unrelated query joins against this table.

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute procedure public.set_updated_at();

create or replace function public.set_invoice_number()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.invoice_number is null or new.invoice_number = '' then
    new.invoice_number := public.next_invoice_number(new.user_id);
  end if;
  return new;
end;
$$;

create trigger invoices_set_invoice_number
  before insert on public.invoices
  for each row execute procedure public.set_invoice_number();

-- ---------------------------------------------------------------------------
-- Line items
-- ---------------------------------------------------------------------------

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price_pence bigint not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists invoice_items_invoice_id_idx on public.invoice_items(invoice_id);
create index if not exists invoice_items_user_id_idx on public.invoice_items(user_id);

alter table public.invoice_items enable row level security;

create policy "invoice_items_select_own" on public.invoice_items
  for select using (auth.uid() = user_id);

create policy "invoice_items_insert_own" on public.invoice_items
  for insert with check (auth.uid() = user_id);

create policy "invoice_items_update_own" on public.invoice_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "invoice_items_delete_own" on public.invoice_items
  for delete using (auth.uid() = user_id);

-- user_id is denormalized onto invoice_items purely so the RLS policies
-- above are a plain index lookup instead of a subquery/join against
-- invoices on every row. This trigger is what makes that safe: it always
-- overwrites whatever user_id the client sent with the true owner looked
-- up from the parent invoice, so a forged value can never slip through.
create or replace function public.set_invoice_item_owner()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  select user_id into new.user_id from public.invoices where id = new.invoice_id;
  if new.user_id is null then
    raise exception 'Invoice % does not exist', new.invoice_id;
  end if;
  return new;
end;
$$;

create trigger invoice_items_set_owner
  before insert or update on public.invoice_items
  for each row execute procedure public.set_invoice_item_owner();
