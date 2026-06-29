-- =============================================================================
-- GermaniaApp — Society Member Directory
-- Relational data model for Supabase (PostgreSQL)
-- =============================================================================
-- Design goals
--   * Members maintain their OWN entry (login via Supabase Auth, enforced by RLS).
--   * Members record precise professions ("urologist", "real-estate-specialized
--     lawyer") with an optional taxonomy for clean searching.
--   * Members add spouses and children (relatives), who need not be members.
--   * Proximity search, profession search, contact (email) and a map are all
--     served from geocoded addresses.
--   * Gatherings worldwide, recurring weekly/monthly.
--   * Easy export of address / email lists matching a search.
--   * Clear migration path to RDF/OWL + SPARQL (see ontology.ttl).
--
-- Conventions
--   * UUID primary keys (Supabase-friendly, stable IRIs for the RDF migration).
--   * created_at / updated_at audit columns with a trigger.
--   * PostGIS geography(Point) for fast, correct distance queries.
--   * Row Level Security throughout.
-- =============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "postgis";     -- geography type + distance ops
create extension if not exists "pg_trgm";     -- fuzzy text search on professions

-- -----------------------------------------------------------------------------
-- Shared updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =============================================================================
-- 1. MEMBERS  (one row per society member; the only table tied to auth)
-- =============================================================================
create table member (
    id              uuid primary key default gen_random_uuid(),
    -- Links to Supabase Auth (auth.users.id). Null allowed for members entered
    -- by an admin who have not yet claimed their login.
    auth_user_id    uuid unique references auth.users (id) on delete set null,

    salutation      text,                       -- Dr., Prof., Mr., Ms., ...
    first_name      text not null,
    last_name       text not null,
    maiden_name     text,
    date_of_birth   date not null,              -- required; age is derived from it
    gender          text check (gender in ('female','male','other','undisclosed')),

    email           text not null,
    phone           text,
    website         text,
    photo_url       text,                       -- Supabase Storage object URL
    bio             text,

    member_since    date,
    status          text not null default 'active'
                    check (status in ('active','inactive','deceased','pending')),

    -- Privacy: what other members may see. The owner always sees everything.
    visibility      text not null default 'members'
                    check (visibility in ('members','officers','private')),
    show_email      boolean not null default true,
    show_address    boolean not null default true,
    show_family     boolean not null default true,

    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index on member (last_name, first_name);
create index on member using gin (email gin_trgm_ops);
create trigger trg_member_updated before update on member
    for each row execute function set_updated_at();

-- =============================================================================
-- 2. ADDRESSES  (a member may have several: home, work, holiday, ...)
-- =============================================================================
create table address (
    id              uuid primary key default gen_random_uuid(),
    member_id       uuid not null references member (id) on delete cascade,

    label           text not null default 'home'
                    check (label in ('home','work','holiday','other')),
    is_primary      boolean not null default false,

    street          text,
    house_number    text,
    address_line2   text,
    postal_code     text,
    city            text,
    region          text,                       -- state / province / canton
    country_code    char(2),                    -- ISO 3166-1 alpha-2

    -- Geocoded location. geography(Point) stores (lon lat) and gives metre-true
    -- distances via ST_DWithin / ST_Distance.
    geo             geography(Point, 4326),

    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index on address (member_id);
create index on address using gist (geo);       -- spatial index for proximity
create index on address (country_code, city);
create trigger trg_address_updated before update on address
    for each row execute function set_updated_at();

-- At most one primary address per member.
create unique index uq_address_primary
    on address (member_id) where is_primary;

-- =============================================================================
-- 3. PROFESSIONS
-- Two layers:
--   profession_category  — optional controlled taxonomy (field > specialty),
--                          gives clean facets and maps to OWL classes later.
--   member_profession    — the member's PRECISE title (free text), optionally
--                          linked to a category. A member can have several.
-- =============================================================================
create table profession_category (
    id              uuid primary key default gen_random_uuid(),
    -- Self-referencing hierarchy: "Medicine" > "Surgery" > "Urology";
    -- "Law" > "Real estate law".
    parent_id       uuid references profession_category (id) on delete set null,
    name            text not null,
    -- Stable code, handy as the local part of an IRI in RDF (e.g. "urology").
    slug            text not null unique,
    created_at      timestamptz not null default now()
);
create index on profession_category (parent_id);

create table member_profession (
    id              uuid primary key default gen_random_uuid(),
    member_id       uuid not null references member (id) on delete cascade,
    category_id     uuid references profession_category (id) on delete set null,

    -- The precise, member-entered title: "Urologist",
    -- "Real-estate-specialized lawyer", "Pediatric cardiologist".
    title           text not null,
    organization    text,                       -- employer / practice / firm
    is_primary      boolean not null default true,

    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index on member_profession (member_id);
create index on member_profession (category_id);
create index on member_profession using gin (title gin_trgm_ops);  -- fuzzy search
create trigger trg_member_profession_updated before update on member_profession
    for each row execute function set_updated_at();

-- =============================================================================
-- 4. RELATIVES  (spouses & children; not necessarily members themselves)
-- =============================================================================
create table relative (
    id              uuid primary key default gen_random_uuid(),
    member_id       uuid not null references member (id) on delete cascade,

    relationship    text not null
                    check (relationship in ('spouse','partner','child','other')),
    first_name      text not null,
    last_name       text,
    date_of_birth   date,                       -- age is derived from this
    gender          text check (gender in ('female','male','other','undisclosed')),
    email           text,

    -- A relative is a full entry with their own postal address.
    street          text,
    house_number    text,
    postal_code     text,
    city            text,
    region          text,
    country_code    char(2),
    geo             geography(Point, 4326),

    -- If this relative is ALSO a society member, link the two records so the
    -- graph stays consistent (and RDF gets a real hasSpouse/hasChild edge).
    related_member_id uuid references member (id) on delete set null,

    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index on relative (member_id);
create index on relative (related_member_id);
create index on relative using gist (geo);
create trigger trg_relative_updated before update on relative
    for each row execute function set_updated_at();

-- =============================================================================
-- 5. GATHERINGS  (events worldwide; weekly / monthly; recurring)
-- =============================================================================
create table gathering (
    id              uuid primary key default gen_random_uuid(),
    title           text not null,
    description     text,

    -- Location (denormalised so events can be anywhere, not only member homes).
    venue_name      text,
    street          text,
    city            text,
    region          text,
    country_code    char(2),
    geo             geography(Point, 4326),

    starts_at       timestamptz not null,
    ends_at         timestamptz,
    timezone        text,                       -- IANA tz, e.g. 'Europe/Berlin'

    -- Recurrence as an iCalendar RRULE, e.g.
    --   'FREQ=WEEKLY;BYDAY=TH'         (weekly, Thursdays)
    --   'FREQ=MONTHLY;BYDAY=1FR'       (monthly, first Friday)
    -- Null = one-off event.
    recurrence_rule text,

    host_member_id  uuid references member (id) on delete set null,
    visibility      text not null default 'members'
                    check (visibility in ('members','public','private')),

    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index on gathering using gist (geo);
create index on gathering (starts_at);
create trigger trg_gathering_updated before update on gathering
    for each row execute function set_updated_at();

-- Optional RSVP / attendance.
create table gathering_attendance (
    gathering_id    uuid not null references gathering (id) on delete cascade,
    member_id       uuid not null references member (id) on delete cascade,
    rsvp            text not null default 'yes'
                    check (rsvp in ('yes','no','maybe')),
    guests          int not null default 0 check (guests >= 0),
    created_at      timestamptz not null default now(),
    primary key (gathering_id, member_id)
);

-- =============================================================================
-- HELPERS — current member resolution (used by RLS and the search functions)
-- =============================================================================
create or replace function current_member_id()
returns uuid language sql stable as $$
    select id from member where auth_user_id = auth.uid();
$$;

-- Age in whole years from a date of birth (stable: depends on current_date).
create or replace function age_years(dob date)
returns int language sql stable as $$
    select case when dob is null then null
                else extract(year from age(current_date, dob))::int end;
$$;

-- =============================================================================
-- SEARCH & EXPORT  (these back the app's main screens)
-- =============================================================================

-- 6a. Flat directory view: one row per member with primary address + primary
--     profession. Convenient for lists, map markers, and CSV export.
create or replace view member_directory as
select
    m.id,
    m.salutation, m.first_name, m.last_name,
    m.email, m.phone, m.photo_url, m.status, m.visibility, m.show_email,
    m.date_of_birth,
    age_years(m.date_of_birth) as age,
    mp.title              as profession,
    pc.name               as profession_category,
    a.street, a.house_number, a.postal_code, a.city, a.region, a.country_code,
    a.geo,
    st_y(a.geo::geometry) as latitude,
    st_x(a.geo::geometry) as longitude
from member m
left join address a
       on a.member_id = m.id and a.is_primary
left join member_profession mp
       on mp.member_id = m.id and mp.is_primary
left join profession_category pc
       on pc.id = mp.category_id;

-- 6a-bis. Relatives with derived age (one row per spouse/child).
create or replace view relative_detail as
select
    r.*,
    age_years(r.date_of_birth) as age,
    concat_ws(', ',
        nullif(concat_ws(' ', r.street, r.house_number), ''),
        nullif(concat_ws(' ', r.postal_code, r.city), ''),
        r.region, r.country_code) as full_address
from relative r;

-- 6b. Proximity search: members within `radius_km` of a point, nearest first.
--     Returns enough columns to render a result list AND export emails/addresses.
create or replace function members_near(
    in lat double precision,
    in lon double precision,
    in radius_km double precision default 50
)
returns table (
    member_id   uuid,
    full_name   text,
    email       text,
    profession  text,
    city        text,
    country_code char(2),
    distance_km double precision
) language sql stable as $$
    select
        m.id,
        m.first_name || ' ' || m.last_name,
        m.email,
        mp.title,
        a.city,
        a.country_code,
        round((st_distance(
            a.geo,
            st_setsrid(st_makepoint(lon, lat), 4326)::geography
        ) / 1000.0)::numeric, 2)::double precision
    from member m
    join address a on a.member_id = m.id and a.is_primary
    left join member_profession mp on mp.member_id = m.id and mp.is_primary
    where st_dwithin(
            a.geo,
            st_setsrid(st_makepoint(lon, lat), 4326)::geography,
            radius_km * 1000.0
          )
    order by st_distance(a.geo, st_setsrid(st_makepoint(lon, lat), 4326)::geography);
$$;

-- 6c. Profession search: fuzzy match on the precise title OR exact on category
--     slug. e.g. members_by_profession('urolog') or ('lawyer').
create or replace function members_by_profession(in q text)
returns table (
    member_id   uuid,
    full_name   text,
    email       text,
    profession  text,
    organization text,
    city        text,
    country_code char(2)
) language sql stable as $$
    select distinct
        m.id,
        m.first_name || ' ' || m.last_name,
        m.email,
        mp.title,
        mp.organization,
        a.city,
        a.country_code
    from member m
    join member_profession mp on mp.member_id = m.id
    left join profession_category pc on pc.id = mp.category_id
    left join address a on a.member_id = m.id and a.is_primary
    where mp.title ilike '%' || q || '%'
       or pc.name  ilike '%' || q || '%'
       or pc.slug  =     lower(q)
    order by m.last_name;
$$;

-- 6d. Contact-list export: given a set of member ids, return the clean
--     email + postal columns the user wants to copy out as CSV.
create or replace view member_contact_export as
select
    m.id            as member_id,
    m.salutation,
    m.first_name,
    m.last_name,
    case when m.show_email then m.email end                       as email,
    case when m.show_address then
        concat_ws(', ',
            nullif(concat_ws(' ', a.street, a.house_number), ''),
            nullif(concat_ws(' ', a.postal_code, a.city), ''),
            a.region, a.country_code)
    end                                                           as postal_address
from member m
left join address a on a.member_id = m.id and a.is_primary;

-- =============================================================================
-- ROW LEVEL SECURITY
--   * Any authenticated member can READ entries that are visible to members.
--   * A member can INSERT/UPDATE/DELETE only their OWN record and its children.
-- =============================================================================
alter table member               enable row level security;
alter table address              enable row level security;
alter table member_profession    enable row level security;
alter table relative             enable row level security;
alter table gathering            enable row level security;
alter table gathering_attendance enable row level security;
alter table profession_category  enable row level security;

-- MEMBER ------------------------------------------------------------------
create policy member_read on member for select to authenticated
    using (visibility <> 'private' or auth_user_id = auth.uid());
create policy member_insert on member for insert to authenticated
    with check (auth_user_id = auth.uid());
create policy member_update on member for update to authenticated
    using (auth_user_id = auth.uid())
    with check (auth_user_id = auth.uid());

-- ADDRESS / PROFESSION / RELATIVE — owned via member_id ---------------------
create policy address_read on address for select to authenticated using (true);
create policy address_write on address for all to authenticated
    using (member_id = current_member_id())
    with check (member_id = current_member_id());

create policy mp_read on member_profession for select to authenticated using (true);
create policy mp_write on member_profession for all to authenticated
    using (member_id = current_member_id())
    with check (member_id = current_member_id());

create policy relative_read on relative for select to authenticated using (true);
create policy relative_write on relative for all to authenticated
    using (member_id = current_member_id())
    with check (member_id = current_member_id());

-- PROFESSION TAXONOMY — read-only to members, managed by admins/service role -
create policy pc_read on profession_category for select to authenticated using (true);

-- GATHERINGS — all members read; host (or any member) may create; host edits --
create policy gathering_read on gathering for select to authenticated
    using (visibility <> 'private' or host_member_id = current_member_id());
create policy gathering_insert on gathering for insert to authenticated
    with check (host_member_id = current_member_id());
create policy gathering_update on gathering for update to authenticated
    using (host_member_id = current_member_id())
    with check (host_member_id = current_member_id());

create policy attendance_read on gathering_attendance for select to authenticated
    using (true);
create policy attendance_write on gathering_attendance for all to authenticated
    using (member_id = current_member_id())
    with check (member_id = current_member_id());

-- =============================================================================
-- MINIMAL SEED (illustrative — safe to delete)
-- =============================================================================
insert into profession_category (name, slug, parent_id) values
    ('Medicine','medicine', null),
    ('Law','law', null);
insert into profession_category (name, slug, parent_id)
    select 'Urology','urology', id from profession_category where slug='medicine';
insert into profession_category (name, slug, parent_id)
    select 'Real estate law','real-estate-law', id from profession_category where slug='law';

-- =============================================================================
-- End of schema
-- =============================================================================
