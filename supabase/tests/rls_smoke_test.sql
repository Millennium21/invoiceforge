-- ============================================================================
-- rls_smoke_test.sql
--
-- A lightweight, dependency-free alternative to a full pgTAP suite: asserts
-- tenant isolation and the trickier trigger logic (invoice numbering,
-- forged-owner correction) actually behave as designed. Every assertion
-- either RAISE NOTICEs "PASS: ..." or RAISE EXCEPTIONs "FAIL: ...", so a
-- non-zero psql exit / ON_ERROR_STOP catches a regression immediately.
--
-- This runs against the vanilla-Postgres stub in 00/01; on a real Supabase
-- project the equivalent behaviour is exercised by hand during QA, or by
-- porting these same assertions into a pgTAP suite (see README "Testing").
-- ============================================================================

begin;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com');

do $$
begin
  if (select count(*) from public.profiles
      where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')) != 2
  then
    raise exception 'FAIL: handle_new_user trigger did not create both profile rows';
  end if;
  if (select count(*) from public.subscriptions
      where user_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')) != 2
  then
    raise exception 'FAIL: handle_new_user_subscription trigger did not create both subscription rows';
  end if;
  raise notice 'PASS: signup triggers provisioned profile + free-tier subscription rows';
end $$;

-- ---- Act as Alice -----------------------------------------------------
set role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.clients (id, user_id, name)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Acme Ltd');

insert into public.invoices (id, user_id, client_id, due_date)
values ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-0000-0000-0000-000000000001', current_date + 14);

-- Forged owner: Bob's id sent on a row that belongs to Alice's invoice.
-- The set_invoice_item_owner trigger must overwrite it, not trust it.
insert into public.invoice_items (id, invoice_id, user_id, description, quantity, unit_price_pence)
values ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222', 'Design work', 2, 50000);

do $$
declare v_owner uuid;
begin
  select user_id into v_owner from public.invoice_items where id = 'cccccccc-0000-0000-0000-000000000001';
  if v_owner is distinct from '11111111-1111-1111-1111-111111111111'::uuid then
    raise exception 'FAIL: invoice_items owner trigger did not overwrite forged user_id (got %)', v_owner;
  end if;
  raise notice 'PASS: invoice_items owner trigger overwrote the forged user_id with the real invoice owner';
end $$;

insert into public.invoices (id, user_id, client_id, due_date)
values ('bbbbbbbb-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-0000-0000-0000-000000000001', current_date + 14);

do $$
declare v_first text; v_second text;
begin
  select invoice_number into v_first from public.invoices where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  select invoice_number into v_second from public.invoices where id = 'bbbbbbbb-0000-0000-0000-000000000002';
  if v_first != 'INV-0001' or v_second != 'INV-0002' then
    raise exception 'FAIL: expected INV-0001 then INV-0002, got % then %', v_first, v_second;
  end if;
  raise notice 'PASS: sequential per-tenant invoice numbering works (% then %)', v_first, v_second;
end $$;

-- ---- Act as Bob: must be fully isolated from Alice's data --------------
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

do $$
begin
  if exists (select 1 from public.clients where id = 'aaaaaaaa-0000-0000-0000-000000000001') then
    raise exception 'FAIL: Bob can see Alice''s client row through RLS';
  end if;
  if exists (select 1 from public.invoices where id = 'bbbbbbbb-0000-0000-0000-000000000001') then
    raise exception 'FAIL: Bob can see Alice''s invoice row through RLS';
  end if;
  if exists (select 1 from public.invoice_items where id = 'cccccccc-0000-0000-0000-000000000001') then
    raise exception 'FAIL: Bob can see Alice''s invoice_items row through RLS';
  end if;
  raise notice 'PASS: Bob sees zero rows of Alice''s across clients/invoices/invoice_items';
end $$;

do $$
declare v_rows int;
begin
  update public.clients set name = 'hacked' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows != 0 then
    raise exception 'FAIL: Bob''s UPDATE against Alice''s client affected % rows, expected 0', v_rows;
  end if;
  raise notice 'PASS: Bob''s UPDATE against Alice''s client affected 0 rows';
end $$;

insert into public.clients (id, user_id, name)
values ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Bob''s client');

insert into public.invoices (id, user_id, client_id, due_date)
values ('bbbbbbbb-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222',
        'aaaaaaaa-0000-0000-0000-000000000002', current_date + 14);

do $$
declare v_number text;
begin
  select invoice_number into v_number from public.invoices where id = 'bbbbbbbb-0000-0000-0000-000000000003';
  if v_number != 'INV-0001' then
    raise exception 'FAIL: Bob''s numbering should start independently at INV-0001, got %', v_number;
  end if;
  raise notice 'PASS: Bob''s invoice numbering is independent of Alice''s counter (%)', v_number;
end $$;

-- Bob must not be able to plant a row under Alice's user_id via INSERT.
do $$
declare v_inserted boolean := false;
begin
  begin
    insert into public.clients (user_id, name) values ('11111111-1111-1111-1111-111111111111', 'forged');
    v_inserted := true;
  exception
    when others then
      v_inserted := false;
  end;

  if v_inserted then
    raise exception 'FAIL: Bob inserted a client row under Alice''s user_id — RLS WITH CHECK did not block it';
  else
    raise notice 'PASS: INSERT forging Alice''s user_id was rejected by RLS WITH CHECK';
  end if;
end $$;

-- ---- create_invoice_with_items: atomic invoice + line items ------------
select public.create_invoice_with_items(
  '22222222-2222-2222-2222-222222222222'::uuid,
  'aaaaaaaa-0000-0000-0000-000000000002'::uuid,
  'GBP', current_date, current_date + 14,
  'percent', 10, 20, 'Thanks for your business',
  false, null, null,
  100000, 10000, 18000, 108000,
  '[{"description":"Consulting","quantity":1,"unitPricePence":100000}]'::jsonb
);

do $$
declare v_invoice_id uuid; v_item_count int; v_total bigint;
begin
  select id, total_pence into v_invoice_id, v_total
    from public.invoices
    where user_id = '22222222-2222-2222-2222-222222222222' and invoice_number = 'INV-0002';

  if v_invoice_id is null then
    raise exception 'FAIL: create_invoice_with_items did not create the invoice row';
  end if;

  select count(*) into v_item_count from public.invoice_items where invoice_id = v_invoice_id;
  if v_item_count != 1 then
    raise exception 'FAIL: expected 1 line item written atomically, found %', v_item_count;
  end if;
  if v_total != 108000 then
    raise exception 'FAIL: expected total_pence 108000, got %', v_total;
  end if;

  raise notice 'PASS: create_invoice_with_items wrote invoice + % line item(s) atomically (total %p)', v_item_count, v_total;
end $$;

-- Bob must not be able to forge someone else's p_user_id through the RPC.
do $$
declare v_blocked boolean := false;
begin
  begin
    perform public.create_invoice_with_items(
      '11111111-1111-1111-1111-111111111111'::uuid, -- Alice's id, but Bob is calling
      'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
      'GBP', current_date, current_date + 14,
      'none', 0, 0, null, false, null, null,
      1000, 0, 0, 1000,
      '[{"description":"x","quantity":1,"unitPricePence":1000}]'::jsonb
    );
  exception
    when others then
      v_blocked := true;
  end;

  if not v_blocked then
    raise exception 'FAIL: create_invoice_with_items let Bob write an invoice under Alice''s user_id';
  end if;
  raise notice 'PASS: create_invoice_with_items rejected a forged p_user_id';
end $$;

-- ---- Privilege lockdown: cross-tenant / internal functions must not be
-- directly callable by an ordinary authenticated user -------------------
do $$
declare v_blocked boolean := false;
begin
  begin
    perform public.generate_due_recurring_invoices();
  exception
    when insufficient_privilege then
      v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'FAIL: authenticated role could call generate_due_recurring_invoices() directly';
  end if;
  raise notice 'PASS: generate_due_recurring_invoices() is not callable by the authenticated role';
end $$;

do $$
declare v_blocked boolean := false;
begin
  begin
    perform public.next_invoice_number('11111111-1111-1111-1111-111111111111'::uuid);
  exception
    when insufficient_privilege then
      v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'FAIL: authenticated role could call next_invoice_number() directly';
  end if;
  raise notice 'PASS: next_invoice_number() is not callable by the authenticated role';
end $$;

reset role;

-- ---- generate_due_recurring_invoices, exercised as service_role --------
insert into public.clients (id, user_id, name)
values ('aaaaaaaa-0000-0000-0000-000000000099', '11111111-1111-1111-1111-111111111111', 'Recurring Co');

insert into public.invoices (
  id, user_id, client_id, issue_date, due_date, is_recurring, recurrence_interval,
  next_invoice_date, subtotal_pence, total_pence, status
) values (
  'bbbbbbbb-0000-0000-0000-00000000009a', '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-0000-0000-0000-000000000099', current_date - 30, current_date - 16,
  true, 'monthly', current_date - 1, 20000, 20000, 'sent'
);

insert into public.invoice_items (invoice_id, user_id, description, quantity, unit_price_pence)
values ('bbbbbbbb-0000-0000-0000-00000000009a', '11111111-1111-1111-1111-111111111111', 'Retainer', 1, 20000);

set role service_role;
select public.generate_due_recurring_invoices();
reset role;

do $$
declare v_generated_count int; v_new_next_date date;
begin
  select count(*) into v_generated_count
  from public.invoices
  where recurrence_parent_id = 'bbbbbbbb-0000-0000-0000-00000000009a';

  select next_invoice_date into v_new_next_date
  from public.invoices where id = 'bbbbbbbb-0000-0000-0000-00000000009a';

  if v_generated_count != 1 then
    raise exception 'FAIL: expected exactly 1 generated invoice, got %', v_generated_count;
  end if;
  if v_new_next_date != (current_date - 1) + interval '1 month' then
    raise exception 'FAIL: template next_invoice_date should advance by 1 month from its prior value, got %', v_new_next_date;
  end if;
  raise notice 'PASS: generate_due_recurring_invoices() generated % invoice and advanced next_invoice_date to %', v_generated_count, v_new_next_date;
end $$;

-- ---- Expenses: isolation -------------------------------------------------
set role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.expenses (id, user_id, client_id, description, amount_pence, is_billable)
values ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-0000-0000-0000-000000000001', 'Train ticket', 4500, true);

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

do $$
begin
  if exists (select 1 from public.expenses where id = 'dddddddd-0000-0000-0000-000000000001') then
    raise exception 'FAIL: Bob can see Alice''s expense through RLS';
  end if;
  raise notice 'PASS: Bob cannot see Alice''s expense';
end $$;

-- ---- Time entries: one running timer per user, DB-enforced --------------
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.time_entries (id, user_id, client_id, description)
values ('eeeeeeee-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-0000-0000-0000-000000000001', 'Design work');

do $$
declare v_blocked boolean := false;
begin
  begin
    insert into public.time_entries (user_id, client_id, description)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'Second timer');
  exception
    when unique_violation then
      v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'FAIL: a second concurrently-running timer was allowed for the same user';
  end if;
  raise notice 'PASS: one-running-timer-per-user is enforced by the database, not just the UI';
end $$;

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into public.time_entries (user_id, client_id, description)
values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000002', 'Bob''s timer');

do $$
begin
  raise notice 'PASS: Bob can run his own timer independently of Alice''s';
end $$;

-- ---- Invoice messages: sender cannot be forged, isolation holds --------
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.invoice_messages (invoice_id, user_id, sender, body)
values ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'freelancer', 'Thanks for your business!');

do $$
declare v_blocked boolean := false;
begin
  begin
    insert into public.invoice_messages (invoice_id, user_id, sender, body)
    values ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'client', 'forged as client');
  exception
    when others then
      v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'FAIL: an authenticated freelancer could insert a message forged as sender = client';
  end if;
  raise notice 'PASS: RLS rejects sender = client from an authenticated insert (real client posts go through the admin-client server action instead)';
end $$;

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
begin
  if exists (select 1 from public.invoice_messages where invoice_id = 'bbbbbbbb-0000-0000-0000-000000000001') then
    raise exception 'FAIL: Bob can see messages on Alice''s invoice through RLS';
  end if;
  raise notice 'PASS: Bob cannot see Alice''s invoice messages';
end $$;

-- ---- Invoice templates: atomic RPC + forged-owner rejection + isolation
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select public.create_template_with_items(
  '11111111-1111-1111-1111-111111111111'::uuid,
  'Logo design package', null, 'none', 0, null,
  '[{"description":"Logo design","quantity":1,"unitPricePence":50000},{"description":"Brand guide","quantity":1,"unitPricePence":20000}]'::jsonb
);

do $$
declare v_template_id uuid; v_item_count int;
begin
  select id into v_template_id from public.invoice_templates
    where user_id = '11111111-1111-1111-1111-111111111111' and name = 'Logo design package';
  if v_template_id is null then
    raise exception 'FAIL: create_template_with_items did not create the template row';
  end if;
  select count(*) into v_item_count from public.invoice_template_items where template_id = v_template_id;
  if v_item_count != 2 then
    raise exception 'FAIL: expected 2 template items written atomically, found %', v_item_count;
  end if;
  raise notice 'PASS: create_template_with_items wrote template + % item(s) atomically', v_item_count;
end $$;

do $$
declare v_blocked boolean := false;
begin
  begin
    perform public.create_template_with_items(
      '22222222-2222-2222-2222-222222222222'::uuid, -- Bob's id, but Alice is calling
      'forged', null, 'none', 0, null, '[]'::jsonb
    );
  exception
    when others then
      v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'FAIL: create_template_with_items let Alice write a template under Bob''s user_id';
  end if;
  raise notice 'PASS: create_template_with_items rejected a forged p_user_id';
end $$;

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
begin
  if exists (select 1 from public.invoice_templates where name = 'Logo design package') then
    raise exception 'FAIL: Bob can see Alice''s invoice template through RLS';
  end if;
  raise notice 'PASS: Bob cannot see Alice''s invoice template';
end $$;

reset role;
rollback;

\echo '=================================================='
\echo ' ALL RLS SMOKE TESTS PASSED'
\echo '=================================================='
