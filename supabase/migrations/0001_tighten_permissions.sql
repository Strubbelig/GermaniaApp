-- =============================================================================
-- Migration 0001 — tighten permissions
-- Apply to an existing database (the changes are already baked into schema.sql
-- for fresh installs). Safe to re-run.
--
-- Result:
--   • Members: read everything; write only their own profile/family/Chargen,
--     send Ganze, and book the Stocherkahn.
--   • Admins: manage events, the Stocherkahn season, taxonomy and any booking,
--     and add members.
--   • Deleting a member: database owner only (no app policy — not even admins).
-- =============================================================================

-- Members can no longer be deleted through the app (only directly in the DB).
drop policy if exists member_admin_delete on member;

-- Admins may add (insert) members.
drop policy if exists member_admin_insert on member;
create policy member_admin_insert on member for insert to authenticated
  with check (is_admin());

-- Content management is admin-only (previously officer+admin via is_staff()).
drop policy if exists pc_staff_write on profession_category;
create policy pc_staff_write on profession_category for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists gathering_staff_write on gathering;
create policy gathering_staff_write on gathering for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists booking_staff_write on stocherkahn_booking;
create policy booking_staff_write on stocherkahn_booking for all to authenticated
  using (is_admin()) with check (is_admin());

-- (season_staff_write was already admin-only — no change needed.)
