-- Default privileges so every table/function the migrations create
-- afterward automatically inherits the right grants — this is what real
-- Supabase configures out of the box, which is why a migration never
-- needs its own GRANT statements in a real project. Must run before the
-- migrations for that inheritance to apply; roles themselves are created
-- earlier, in 00_supabase_stub.sql.

grant usage on schema public to authenticated, anon, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant execute on functions to service_role;
