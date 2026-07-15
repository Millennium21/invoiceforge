-- Minimal stand-in for the auth/storage schemas Supabase provides in a real
-- project, so our real migration files can be executed and sanity-checked
-- against vanilla Postgres. This file is NOT part of the real migration set
-- and must never be run against an actual Supabase project (which already
-- has these schemas, and they're managed by Supabase, not us).

create extension if not exists pgcrypto;

-- Roles first — everything below this grants privileges to them.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    -- Real Supabase creates service_role with BYPASSRLS, which is the
    -- actual mechanism behind "the service-role key bypasses RLS" — a
    -- plain Postgres role attribute, not something PostgREST fakes.
    create role service_role bypassrls nologin;
  end if;
end $$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- In real Supabase, auth.uid() reads the "sub" claim out of the request's
-- verified JWT. Here we read a session GUC so tests can impersonate users.
create or replace function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

-- Real Supabase grants authenticated/anon direct EXECUTE on auth.uid()
-- (and USAGE on the auth schema) — it's meant to be called directly, not
-- just implicitly from within RLS policy expressions.
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;

create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid
);

create or replace function storage.foldername(name text) returns text[]
  language sql immutable
  as $$ select string_to_array(name, '/') $$;

