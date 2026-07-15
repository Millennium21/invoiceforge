-- ============================================================================
-- 0001_profiles.sql
-- Tenant root table. One row per freelancer, 1:1 with auth.users.
-- Every other tenant table hangs off profiles.id (== auth.uid()).
-- ============================================================================

-- Shared trigger function used by every table below to keep updated_at fresh.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  business_name text,
  full_name text,
  logo_url text,
  brand_color text not null default '#2B4C6F',
  address text,
  tax_number text,                    -- UTR / VAT number, freelancer's own reference
  default_currency text not null default 'GBP',
  default_tax_rate numeric(5,2) not null default 0,   -- most sole traders aren't VAT-registered
  invoice_prefix text not null default 'INV-',
  next_invoice_number int not null default 1,
  marketing_consent boolean not null default false,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- No insert/delete policies for authenticated users on purpose: rows are
-- created by the trigger below (security definer) and removed only via
-- cascading delete when the auth.users row is deleted (GDPR account deletion).

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- Auto-provision a profile row the moment someone signs up, whichever auth
-- method they used (magic link or Google OAuth both insert into auth.users).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Atomically reserves the next invoice number for a tenant. Row-locks the
-- profile row (`for update`) so two concurrent "create invoice" requests
-- from the same freelancer can never be handed the same number.
create or replace function public.next_invoice_number(p_user_id uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_prefix text;
  v_next int;
begin
  select invoice_prefix, next_invoice_number
    into v_prefix, v_next
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'No profile found for user %', p_user_id;
  end if;

  update public.profiles
  set next_invoice_number = v_next + 1
  where id = p_user_id;

  return v_prefix || lpad(v_next::text, 4, '0');
end;
$$;
