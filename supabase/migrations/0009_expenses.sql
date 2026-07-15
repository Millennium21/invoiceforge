-- ============================================================================
-- 0009_expenses.sql
--
-- Unlike logos (0006), receipts are sensitive financial documents, so this
-- bucket is private — no public_read policy. Everything else follows the
-- same owner-scoped pattern as clients/invoices.
-- ============================================================================

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  description text not null,
  category text not null default 'other'
    check (category in ('travel', 'software', 'materials', 'subcontractor', 'other')),
  amount_pence bigint not null check (amount_pence >= 0),
  currency text not null default 'GBP',
  expense_date date not null default current_date,
  receipt_url text,
  is_billable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_user_id_idx on public.expenses(user_id);
create index if not exists expenses_client_id_idx on public.expenses(client_id);
-- Powers "unbilled billable expenses for this client" in the invoice form.
create index if not exists expenses_unbilled_idx on public.expenses(user_id, client_id)
  where is_billable = true and invoice_id is null;

alter table public.expenses enable row level security;

create policy "expenses_select_own" on public.expenses
  for select using (auth.uid() = user_id);
create policy "expenses_insert_own" on public.expenses
  for insert with check (auth.uid() = user_id);
create policy "expenses_update_own" on public.expenses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "expenses_delete_own" on public.expenses
  for delete using (auth.uid() = user_id);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute procedure public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "receipts_owner_select" on storage.objects
  for select using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "receipts_owner_insert" on storage.objects
  for insert with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "receipts_owner_update" on storage.objects
  for update using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "receipts_owner_delete" on storage.objects
  for delete using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
