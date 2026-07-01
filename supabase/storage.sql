-- =============================================================================
-- GermaniaApp — Storage bucket for member photos
-- Run after schema.sql. Creates a public-read bucket where each member can
-- upload only into their own folder (prefixed with their auth user id).
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('member-photos', 'member-photos', true)
on conflict (id) do nothing;

-- Anyone (incl. anon) may READ photos (directory is members-only at the app
-- layer; tighten to 'authenticated' here if you prefer).
create policy "member photos are readable"
on storage.objects for select
using (bucket_id = 'member-photos');

-- A member may write only into a folder named after their auth uid:
--   member-photos/<auth.uid()>/whatever.jpg
create policy "members upload to own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'member-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "members update own photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'member-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "members delete own photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'member-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Ganzen before/after photos ------------------------------------------------
insert into storage.buckets (id, name, public)
values ('ganze-photos', 'ganze-photos', true)
on conflict (id) do nothing;

create policy "ganze photos readable"
on storage.objects for select
using (bucket_id = 'ganze-photos');

create policy "members upload ganze photos to own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ganze-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
