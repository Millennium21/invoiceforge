-- ============================================================================
-- 0006_storage_logos.sql
--
-- Logos are readable by anyone with the URL (they're embedded in public
-- invoice pages and PDFs sent to clients, so there's nothing to protect),
-- but only the owning freelancer can upload/replace/delete their own.
-- Objects are keyed as "{user_id}/logo.<ext>" and the write policies check
-- that the first path segment matches auth.uid() — never trusting a
-- client-supplied user_id anywhere else in the path.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'])
on conflict (id) do nothing;

create policy "logos_public_read" on storage.objects
  for select using (bucket_id = 'logos');

create policy "logos_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "logos_owner_update" on storage.objects
  for update using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "logos_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
