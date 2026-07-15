-- ============================================================================
-- 0007_invoice_write_rpc.sql
--
-- Two functions that write across invoices + invoice_items in one
-- transaction, because two sequential PostgREST requests from the JS
-- client (insert invoice, then insert items) can't be made atomic from
-- the client side — a crash between them would leave a real invoice row
-- with zero line items.
-- ============================================================================

-- security invoker (not definer): this runs with the CALLING role's own
-- privileges, so RLS still applies as a backstop even though we also
-- check auth.uid() explicitly up front for a clearer error message.
create or replace function public.create_invoice_with_items(
  p_user_id uuid,
  p_client_id uuid,
  p_currency text,
  p_issue_date date,
  p_due_date date,
  p_discount_type text,
  p_discount_value numeric,
  p_tax_rate_percent numeric,
  p_notes text,
  p_is_recurring boolean,
  p_recurrence_interval text,
  p_recurrence_end_date date,
  p_subtotal_pence bigint,
  p_discount_pence bigint,
  p_tax_pence bigint,
  p_total_pence bigint,
  p_items jsonb
)
returns public.invoices
language plpgsql
security invoker
as $$
declare
  v_invoice public.invoices;
  v_item jsonb;
  v_sort_order int := 0;
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'p_user_id must match the authenticated caller';
  end if;

  if jsonb_array_length(p_items) < 1 then
    raise exception 'An invoice needs at least one line item';
  end if;

  insert into public.invoices (
    user_id, client_id, currency, issue_date, due_date,
    discount_type, discount_value, tax_rate_percent, notes,
    is_recurring, recurrence_interval, recurrence_end_date,
    subtotal_pence, discount_pence, tax_pence, total_pence,
    next_invoice_date
  ) values (
    p_user_id, p_client_id, p_currency, p_issue_date, p_due_date,
    p_discount_type, p_discount_value, p_tax_rate_percent, nullif(p_notes, ''),
    p_is_recurring, p_recurrence_interval, p_recurrence_end_date,
    p_subtotal_pence, p_discount_pence, p_tax_pence, p_total_pence,
    case when p_is_recurring then public.compute_next_recurrence_date(p_issue_date, p_recurrence_interval) end
  )
  returning * into v_invoice;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.invoice_items (invoice_id, user_id, description, quantity, unit_price_pence, sort_order)
    values (
      v_invoice.id,
      p_user_id,
      v_item ->> 'description',
      (v_item ->> 'quantity')::numeric,
      (v_item ->> 'unitPricePence')::bigint,
      v_sort_order
    );
    v_sort_order := v_sort_order + 1;
  end loop;

  return v_invoice;
end;
$$;

create or replace function public.compute_next_recurrence_date(p_from date, p_interval text)
returns date
language sql
immutable
as $$
  select case p_interval
    when 'weekly' then p_from + interval '7 days'
    when 'monthly' then p_from + interval '1 month'
    when 'quarterly' then p_from + interval '3 months'
    when 'yearly' then p_from + interval '1 year'
  end::date
$$;

-- ---------------------------------------------------------------------------
-- Recurring invoice generation. Runs cross-tenant, so it MUST be
-- security definer + locked to service_role only (see 0008 for the
-- explicit privilege lockdown — Postgres grants EXECUTE to PUBLIC by
-- default on every new function, which would otherwise let any signed-in
-- user generate invoices on every other tenant's account).
--
-- Each template is processed in its own sub-transaction (the nested
-- begin/exception block below creates an implicit savepoint) so one
-- tenant's bad data can't roll back every other tenant's invoices in the
-- same run.
-- ---------------------------------------------------------------------------
create or replace function public.generate_due_recurring_invoices()
returns setof public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template record;
  v_new_invoice public.invoices;
  v_gap_days int;
begin
  for v_template in
    select * from public.invoices
    where is_recurring = true
      and next_invoice_date is not null
      and next_invoice_date <= current_date
      and (recurrence_end_date is null or next_invoice_date <= recurrence_end_date)
  loop
    begin
      v_gap_days := v_template.due_date - v_template.issue_date;

      insert into public.invoices (
        user_id, client_id, currency, issue_date, due_date,
        discount_type, discount_value, tax_rate_percent, notes,
        is_recurring, recurrence_parent_id,
        subtotal_pence, discount_pence, tax_pence, total_pence,
        status, sent_at
      ) values (
        v_template.user_id, v_template.client_id, v_template.currency,
        current_date, current_date + v_gap_days,
        v_template.discount_type, v_template.discount_value, v_template.tax_rate_percent, v_template.notes,
        false, v_template.id,
        v_template.subtotal_pence, v_template.discount_pence, v_template.tax_pence, v_template.total_pence,
        'sent', now()
      )
      returning * into v_new_invoice;

      insert into public.invoice_items (invoice_id, user_id, description, quantity, unit_price_pence, sort_order)
      select v_new_invoice.id, v_template.user_id, description, quantity, unit_price_pence, sort_order
      from public.invoice_items
      where invoice_id = v_template.id;

      update public.invoices
      set next_invoice_date = public.compute_next_recurrence_date(v_template.next_invoice_date, v_template.recurrence_interval)
      where id = v_template.id;

      return next v_new_invoice;
    exception when others then
      raise warning 'Skipped recurring invoice for template %: %', v_template.id, sqlerrm;
    end;
  end loop;
  return;
end;
$$;
