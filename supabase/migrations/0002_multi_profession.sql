-- =============================================================================
-- Migration 0002 — one row per member when they have several professions
-- A member with two professions (both flagged primary) appeared twice in the
-- directory / proximity results. These views/functions now aggregate all of a
-- member's professions into one comma-separated value → exactly one row each.
-- Safe to run on an existing database.
-- =============================================================================

create or replace view member_directory as
select
    m.id,
    m.salutation, m.first_name, m.last_name,
    m.email, m.phone, m.photo_url, m.status, m.visibility, m.show_email,
    m.date_of_birth,
    age_years(m.date_of_birth) as age,
    m.entry_semester,
    m.corp_status,
    m.fencing_bouts,
    (select string_agg(office_abbr(oh.office_code) || ' ' || coalesce(oh.semester, ''), ', '
                       order by oh.semester)
       from office_history oh where oh.member_id = m.id) as charges,
    (select string_agg(mp.title, ', ' order by mp.is_primary desc, mp.created_at)
       from member_profession mp where mp.member_id = m.id) as profession,
    (select pc.name from member_profession mp
       left join profession_category pc on pc.id = mp.category_id
       where mp.member_id = m.id
       order by mp.is_primary desc, mp.created_at limit 1) as profession_category,
    a.street, a.house_number, a.postal_code, a.city, a.region, a.country_code,
    a.geo,
    st_y(a.geo::geometry) as latitude,
    st_x(a.geo::geometry) as longitude
from member m
left join address a on a.member_id = m.id and a.is_primary
where m.consented;

create or replace view deceased_directory as
select
    m.id, m.salutation, m.first_name, m.last_name, m.maiden_name,
    m.date_of_birth, m.date_of_death, m.photo_url, m.trivia,
    extract(year from m.date_of_birth)::int as birth_year,
    extract(year from m.date_of_death)::int as death_year,
    (select string_agg(mp.title, ', ' order by mp.is_primary desc, mp.created_at)
       from member_profession mp where mp.member_id = m.id) as profession
from member m
where m.status = 'deceased';

create or replace function members_near(
    in lat double precision, in lon double precision, in radius_km double precision default 50
)
returns table (
    member_id uuid, full_name text, email text, profession text,
    city text, country_code char(2), distance_km double precision
) language sql stable as $$
    select
        m.id,
        m.first_name || ' ' || m.last_name,
        m.email,
        (select string_agg(mp.title, ', ' order by mp.is_primary desc, mp.created_at)
           from member_profession mp where mp.member_id = m.id),
        a.city,
        a.country_code,
        round((st_distance(a.geo, st_setsrid(st_makepoint(lon, lat), 4326)::geography) / 1000.0)::numeric, 2)::double precision
    from member m
    join address a on a.member_id = m.id and a.is_primary
    where st_dwithin(a.geo, st_setsrid(st_makepoint(lon, lat), 4326)::geography, radius_km * 1000.0)
    order by st_distance(a.geo, st_setsrid(st_makepoint(lon, lat), 4326)::geography);
$$;
