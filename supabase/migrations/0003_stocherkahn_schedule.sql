-- =============================================================================
-- Migration 0003 — Stocherkahn booking schedule view
-- Adds a view for the browsable "who has the boat, when, how long" schedule.
-- Payment was dropped in the app (bookings are free + confirmed immediately);
-- no schema change is needed for that — the fee columns simply go unused.
-- Safe to run on an existing database.
-- =============================================================================
create or replace view stocherkahn_schedule as
select b.id, b.season_id, b.booking_date, b.starts_at, b.ends_at, b.status,
       b.member_id, (m.first_name || ' ' || m.last_name) as member_name
from stocherkahn_booking b
join member m on m.id = b.member_id
where b.status <> 'cancelled';

grant select on stocherkahn_schedule to anon, authenticated, service_role;
