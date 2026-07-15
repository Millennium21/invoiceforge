-- ============================================================================
-- 0012_invoice_templates.sql
--
-- Mirrors the invoices/invoice_items shape deliberately — a template is
-- just a reusable set of line items without a client, dates, or status.
-- Same denormalized-owner-plus-trigger pattern as invoice_items for the
-- same reason: cheap, indexed RLS instead of a join per row.
-- ============================================================================

create table if not exists public.invoice_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  notes text,
  discount_type text not null default 'none' check (discount_type in ('none', 'percent', 'fixed')),
  discount_value numeric(10,2) not null default 0,
  tax_rate_percent numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoice_templates_user_id_idx on public.invoice_templates(user_id);

alter table public.invoice_templates enable row level security;

create policy "invoice_templates_select_own" on public.invoice_templates
  for select using (auth.uid() = user_id);
create policy "invoice_templates_insert_own" on public.invoice_templates
  for insert with check (auth.uid() = user_id);
create policy "invoice_templates_update_own" on public.invoice_templates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "invoice_templates_delete_own" on public.invoice_templates
  for delete using (auth.uid() = user_id);

create trigger invoice_templates_set_updated_at
  before update on public.invoice_templates
  for each row execute procedure public.set_updated_at();

create table if not exists public.invoice_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.invoice_templates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price_pence bigint not null default 0,
  sort_order int not null default 0
);

create index if not exists invoice_template_items_template_id_idx on public.invoice_template_items(template_id);

alter table public.invoice_template_items enable row level security;

create policy "invoice_template_items_select_own" on public.invoice_template_items
  for select using (auth.uid() = user_id);
create policy "invoice_template_items_insert_own" on public.invoice_template_items
  for insert with check (auth.uid() = user_id);
create policy "invoice_template_items_update_own" on public.invoice_template_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "invoice_template_items_delete_own" on public.invoice_template_items
  for delete using (auth.uid() = user_id);

create or replace function public.set_template_item_owner()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  select user_id into new.user_id from public.invoice_templates where id = new.template_id;
  if new.user_id is null then
    raise exception 'Template % does not exist', new.template_id;
  end if;
  return new;
end;
$$;

create trigger invoice_template_items_set_owner
  before insert or update on public.invoice_template_items
  for each row execute procedure public.set_template_item_owner();

revoke execute on function public.set_template_item_owner() from public;

-- Atomic "create template with items" RPC, same reasoning as
-- create_invoice_with_items in 0007 — two sequential PostgREST requests
-- can't be made atomic from the client.
create or replace function public.create_template_with_items(
  p_user_id uuid,
  p_name text,
  p_notes text,
  p_discount_type text,
  p_discount_value numeric,
  p_tax_rate_percent numeric,
  p_items jsonb
)
returns public.invoice_templates
language plpgsql
security invoker
as $$
declare
  v_template public.invoice_templates;
  v_item jsonb;
  v_sort_order int := 0;
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'p_user_id must match the authenticated caller';
  end if;

  insert into public.invoice_templates (user_id, name, notes, discount_type, discount_value, tax_rate_percent)
  values (p_user_id, p_name, nullif(p_notes, ''), p_discount_type, p_discount_value, p_tax_rate_percent)
  returning * into v_template;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.invoice_template_items (template_id, user_id, description, quantity, unit_price_pence, sort_order)
    values (
      v_template.id, p_user_id,
      v_item ->> 'description',
      (v_item ->> 'quantity')::numeric,
      (v_item ->> 'unitPricePence')::bigint,
      v_sort_order
    );
    v_sort_order := v_sort_order + 1;
  end loop;

  return v_template;
end;
$$;

revoke execute on function public.create_template_with_items(
  uuid, text, text, text, numeric, numeric, jsonb
) from public;
grant execute on function public.create_template_with_items(
  uuid, text, text, text, numeric, numeric, jsonb
) to authenticated;
