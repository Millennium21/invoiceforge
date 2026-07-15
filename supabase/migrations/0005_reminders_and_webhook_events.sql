-- ============================================================================
-- 0005_reminders_and_webhook_events.sql
-- ============================================================================

-- Prevents the "upcoming due" and "overdue" Edge Function from emailing a
-- client twice for the same invoice on the same day if the cron job is ever
-- retried or double-triggered.
create table if not exists public.reminders_log (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('upcoming', 'overdue')),
  sent_on date not null default current_date,
  resend_email_id text,
  created_at timestamptz not null default now(),
  constraint reminders_log_one_per_day unique (invoice_id, reminder_type, sent_on)
);

create index if not exists reminders_log_invoice_id_idx on public.reminders_log(invoice_id);

alter table public.reminders_log enable row level security;

create policy "reminders_log_select_own" on public.reminders_log
  for select using (auth.uid() = user_id);

-- Written only by the send-invoice-reminders Edge Function (service role).

-- ---------------------------------------------------------------------------
-- Stripe webhook idempotency guard. Stripe explicitly documents that events
-- can be delivered more than once; this table turns "process an event" into
-- an atomic insert-or-detect-duplicate so a retried delivery is a safe no-op
-- instead of double-crediting a payment.
-- ---------------------------------------------------------------------------

create table if not exists public.processed_stripe_events (
  id text primary key,             -- Stripe event.id, globally unique
  type text not null,
  processed_at timestamptz not null default now()
);

-- No RLS needed: only ever touched by the service-role client in the
-- webhook handler, which already bypasses RLS. Enabling it with zero
-- policies would just make that access silently fail.
