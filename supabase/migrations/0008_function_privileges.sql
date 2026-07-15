-- ============================================================================
-- 0008_function_privileges.sql
--
-- Postgres grants EXECUTE on every newly created function to PUBLIC by
-- default. That default is fine for an ordinary helper, but is a real
-- vulnerability for a SECURITY DEFINER function: left alone, any signed-in
-- user could call generate_due_recurring_invoices() directly and generate
-- (and email!) invoices on every other tenant's account, or call
-- next_invoice_number() directly to burn through another tenant's invoice
-- numbering sequence. This migration closes that off explicitly rather
-- than relying on "nobody would think to call it" — the trigger-based
-- functions never needed a direct EXECUTE grant in the first place
-- (trigger firing is controlled by the table's trigger definition, not by
-- the invoking role's function privileges), so revoking PUBLIC access
-- doesn't break anything that's actually in use.
-- ============================================================================

revoke execute on function public.set_updated_at() from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user_subscription() from public;
revoke execute on function public.next_invoice_number(uuid) from public;
revoke execute on function public.set_invoice_number() from public;
revoke execute on function public.set_invoice_item_owner() from public;
revoke execute on function public.generate_due_recurring_invoices() from public;

-- create_invoice_with_items is SECURITY INVOKER and genuinely needs to be
-- called directly by signed-in users — that's its whole purpose — so it
-- keeps a real grant rather than being locked to service_role.
revoke execute on function public.create_invoice_with_items(
  uuid, uuid, text, date, date, text, numeric, numeric, text,
  boolean, text, date, bigint, bigint, bigint, bigint, jsonb
) from public;
grant execute on function public.create_invoice_with_items(
  uuid, uuid, text, date, date, text, numeric, numeric, text,
  boolean, text, date, bigint, bigint, bigint, bigint, jsonb
) to authenticated;

-- Cross-tenant background job: only the service role (used exclusively by
-- the scheduled Edge Function) may invoke this.
grant execute on function public.generate_due_recurring_invoices() to service_role;
