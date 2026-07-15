-- ============================================================================
-- 0011_client_messages.sql
--
-- A lightweight two-party thread attached to an invoice, not a new auth
-- system: the client reaches it through the same opaque public_token as
-- the public invoice page. Consistent with that page's own pattern, there
-- is deliberately no RLS policy granting the client (anon) role any
-- access here — client-side posts go through a server action using the
-- admin client, validated by token, exactly like the payment checkout
-- action. `sender` is always set server-side from which action was
-- called, never trusted from client input, so a public POST can never
-- forge a message that looks like it came from the freelancer.
-- ============================================================================

create table if not exists public.invoice_messages (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sender text not null check (sender in ('client', 'freelancer')),
  body text not null check (char_length(body) between 1 and 2000),
  read_by_freelancer_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists invoice_messages_invoice_id_idx on public.invoice_messages(invoice_id);
create index if not exists invoice_messages_unread_idx on public.invoice_messages(user_id)
  where sender = 'client' and read_by_freelancer_at is null;

alter table public.invoice_messages enable row level security;

create policy "invoice_messages_select_own" on public.invoice_messages
  for select using (auth.uid() = user_id);

create policy "invoice_messages_insert_own" on public.invoice_messages
  for insert with check (auth.uid() = user_id and sender = 'freelancer');

create policy "invoice_messages_update_own" on public.invoice_messages
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- No delete policy: a message thread is a record of what was actually
-- said, same reasoning as payments being an immutable log.
