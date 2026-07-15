-- ============================================================================
-- 0004_payments_and_subscriptions.sql
-- ============================================================================

-- Immutable log of money actually received, kept separate from
-- invoices.status so status can evolve (e.g. manual correction) without
-- ever losing the record of what Stripe told us happened and when.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_pence bigint not null,
  currency text not null default 'GBP',
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  status text not null default 'succeeded' check (status in ('succeeded', 'refunded')),
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists payments_invoice_id_idx on public.payments(invoice_id);
create index if not exists payments_paid_at_idx on public.payments(paid_at);

alter table public.payments enable row level security;

create policy "payments_select_own" on public.payments
  for select using (auth.uid() = user_id);

-- No insert/update/delete policies for authenticated users: rows are only
-- ever written by the Stripe webhook handler via the service-role client,
-- which bypasses RLS entirely. Freelancers can view their payment history
-- but never edit it — that would defeat the point of an audit log.

-- ---------------------------------------------------------------------------
-- SaaS subscription state (Starter / Pro), separate from invoice payments
-- ---------------------------------------------------------------------------

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  tier text not null default 'free' check (tier in ('free', 'starter', 'pro')),
  status text not null default 'active'
    check (status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_stripe_customer_id_idx on public.subscriptions(stripe_customer_id);

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Writes happen only via the Stripe webhook handler (service-role client).

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute procedure public.set_updated_at();

-- Every freelancer starts on the free tier the moment they sign up, so
-- lib/payments.ts always has a row to read instead of having to special-case
-- "no subscription row yet" throughout the app.
create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.subscriptions (user_id, tier, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute procedure public.handle_new_user_subscription();
