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
create extension if not exists "btree_gist";  -- overlap exclusion for hourly bookings

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

    -- Access role. 'member' = normal; 'officer' = manage gatherings + taxonomy;
    -- 'admin' = full control over all members. See the ROLES section below.
    role            text not null default 'member'
                    check (role in ('member','officer','admin')),

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

    -- Subsection: Stammtisch (recurring), Semesterprogramm (per-semester) or Pauktag.
    category        text not null default 'other'
                    check (category in ('stammtisch','semesterprogramm','pauktag','other')),
    semester        text,                       -- e.g. 'WS 2026/27' (Semesterprogramm)

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
-- NOTE: members can only READ events. Creating/editing is staff-only, granted by
-- the gathering_staff_write policy in the ROLES section below.

create policy attendance_read on gathering_attendance for select to authenticated
    using (true);
create policy attendance_write on gathering_attendance for all to authenticated
    using (member_id = current_member_id())
    with check (member_id = current_member_id());

-- =============================================================================
-- STOCHERKAHN  (the society's punt boat)
-- A "season" runs from the day the boat is watered (launched) to the day it is
-- withdrawn — set by an admin. Within a season the boat is booked BY THE HOUR,
-- only within that date's dawn–dusk window (computed from the location's
-- sun times). Fee is €1 per hour, paid via Stripe.
-- =============================================================================
create table stocherkahn_season (
    id              uuid primary key default gen_random_uuid(),
    name            text,                       -- e.g. 'Season 2026'
    water_date      date not null,              -- boat goes in the water
    withdraw_date   date not null,              -- boat comes out
    -- Location used to compute dawn/dusk (default Tübingen).
    latitude        double precision not null default 48.5216,
    longitude       double precision not null default 9.0576,
    is_active       boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    check (withdraw_date >= water_date)
);
create trigger trg_season_updated before update on stocherkahn_season
    for each row execute function set_updated_at();
-- Only one active season at a time.
create unique index uq_season_active on stocherkahn_season (is_active) where is_active;

create table stocherkahn_booking (
    id              uuid primary key default gen_random_uuid(),
    season_id       uuid not null references stocherkahn_season (id) on delete cascade,
    member_id       uuid not null references member (id) on delete cascade,

    booking_date    date not null,
    -- The booked HOURLY window (within that date's dawn–dusk), set by the app.
    starts_at       timestamptz not null,
    ends_at         timestamptz not null,
    check (ends_at > starts_at),

    status          text not null default 'pending'
                    check (status in ('pending','confirmed','cancelled')),

    -- €1 reservation fee.
    fee_cents       int not null default 100,
    currency        text not null default 'eur',
    payment_status  text not null default 'unpaid'
                    check (payment_status in ('unpaid','paid','refunded')),
    stripe_session_id        text,
    stripe_payment_intent_id text,

    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index on stocherkahn_booking (season_id, booking_date);
create index on stocherkahn_booking (member_id);
-- The boat is a single resource: no two active bookings may overlap in time.
alter table stocherkahn_booking add constraint no_booking_overlap
    exclude using gist (tstzrange(starts_at, ends_at) with &&)
    where (status <> 'cancelled');
create trigger trg_booking_updated before update on stocherkahn_booking
    for each row execute function set_updated_at();

-- Enforce: a booking date must fall inside its season window.
create or replace function guard_booking_in_season()
returns trigger language plpgsql as $$
declare s stocherkahn_season;
begin
    select * into s from stocherkahn_season where id = new.season_id;
    if new.booking_date < s.water_date or new.booking_date > s.withdraw_date then
        raise exception 'Booking date % is outside the season (% to %)',
            new.booking_date, s.water_date, s.withdraw_date;
    end if;
    return new;
end;
$$;
create trigger trg_booking_in_season before insert or update on stocherkahn_booking
    for each row execute function guard_booking_in_season();

alter table stocherkahn_season  enable row level security;
alter table stocherkahn_booking enable row level security;

-- Everyone signed in can see the season + all bookings (to know availability).
create policy season_read on stocherkahn_season for select to authenticated using (true);
create policy booking_read on stocherkahn_booking for select to authenticated using (true);

-- Members create / cancel their OWN bookings.
create policy booking_insert on stocherkahn_booking for insert to authenticated
    with check (member_id = current_member_id());
create policy booking_update on stocherkahn_booking for update to authenticated
    using (member_id = current_member_id())
    with check (member_id = current_member_id());

-- =============================================================================
-- ROLES & ADMIN
-- Additive: Postgres OR-combines multiple PERMISSIVE policies, so these new
-- policies *grant extra* power to staff/admins without weakening the owner-only
-- rules above. Role checks use SECURITY DEFINER helpers so they bypass RLS on
-- `member` and don't cause policy recursion.
-- =============================================================================

create or replace function current_member_role()
returns text language sql stable security definer set search_path = public as $$
    select role from member where auth_user_id = auth.uid();
$$;

create or replace function is_admin()
returns boolean language sql stable as $$ select current_member_role() = 'admin'; $$;

create or replace function is_staff()
returns boolean language sql stable as $$
    select current_member_role() in ('admin','officer');
$$;

-- Prevent privilege escalation: only an admin may change a member's role.
create or replace function guard_member_role()
returns trigger language plpgsql as $$
begin
    -- Role may change if an admin does it, OR inside a sanctioned office transfer
    -- (the transfer function sets app.role_transfer = 'on' for its transaction).
    if new.role is distinct from old.role
       and not is_admin()
       and coalesce(current_setting('app.role_transfer', true), '') <> 'on' then
        raise exception 'Only an admin can change a member role';
    end if;
    return new;
end;
$$;
create trigger trg_guard_member_role before update on member
    for each row execute function guard_member_role();

-- Admin-only RPC to (de)promote a member.
create or replace function set_member_role(target uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
    if not is_admin() then raise exception 'Not authorized'; end if;
    if new_role not in ('member','officer','admin') then
        raise exception 'Invalid role %', new_role;
    end if;
    update member set role = new_role where id = target;
end;
$$;

-- Admins can update or delete ANY member.
create policy member_admin_update on member for update to authenticated
    using (is_admin()) with check (is_admin());
create policy member_admin_delete on member for delete to authenticated
    using (is_admin());

-- Admins can write any member's addresses / professions / relatives.
create policy address_admin_write on address for all to authenticated
    using (is_admin()) with check (is_admin());
create policy mp_admin_write on member_profession for all to authenticated
    using (is_admin()) with check (is_admin());
create policy relative_admin_write on relative for all to authenticated
    using (is_admin()) with check (is_admin());

-- Staff (officer or admin) manage the profession taxonomy.
create policy pc_staff_write on profession_category for all to authenticated
    using (is_staff()) with check (is_staff());

-- Staff manage any gathering (in addition to the host-only policies above).
create policy gathering_staff_write on gathering for all to authenticated
    using (is_staff()) with check (is_staff());

-- Admins set the Stocherkahn season; staff can manage any booking.
create policy season_staff_write on stocherkahn_season for all to authenticated
    using (is_admin()) with check (is_admin());
create policy booking_staff_write on stocherkahn_booking for all to authenticated
    using (is_staff()) with check (is_staff());

-- =============================================================================
-- OFFICES / ÄMTER  (Sprecher, Fechtwart, Schriftwart)
-- Each office has a current holder who holds admin rights. Offices change every
-- semester via a two-party handover: either the current holder or the incoming
-- member starts it, and the other party confirms. On confirmation the holder
-- swaps, the new holder becomes admin, and the outgoing holder drops to 'member'
-- unless they still hold another office.
-- =============================================================================
create table office (
    id                uuid primary key default gen_random_uuid(),
    code              text not null unique
                      check (code in ('sprecher','fechtwart','schriftwart')),
    title             text not null,            -- German label
    current_holder_id uuid references member (id) on delete set null,
    term_semester     text,                     -- e.g. 'WS 2026/27' (last (re)claim)
    updated_at        timestamptz not null default now()
);
create trigger trg_office_updated before update on office
    for each row execute function set_updated_at();

create table office_transfer (
    id             uuid primary key default gen_random_uuid(),
    office_id      uuid not null references office (id) on delete cascade,
    from_member_id uuid references member (id) on delete set null,
    to_member_id   uuid not null references member (id) on delete cascade,
    initiated_by   uuid not null references member (id) on delete cascade,
    status         text not null default 'pending'
                   check (status in ('pending','accepted','declined','cancelled')),
    created_at     timestamptz not null default now(),
    resolved_at    timestamptz
);
create index on office_transfer (office_id, status);
create index on office_transfer (to_member_id);

-- Holder + name for display.
create or replace view office_directory as
select o.id, o.code, o.title, o.current_holder_id, o.term_semester, o.updated_at,
       (m.first_name || ' ' || m.last_name) as holder_name
from office o
left join member m on m.id = o.current_holder_id;

-- Start a transfer. If the caller is the current holder, p_to is the successor;
-- otherwise the caller is claiming the office (to = caller). Vacant offices are
-- assigned immediately. Returns the transfer id (null if applied immediately).
create or replace function initiate_office_transfer(p_office uuid, p_to uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_caller uuid; v_from uuid; v_to uuid; v_holder uuid; v_id uuid;
begin
    v_caller := current_member_id();
    if v_caller is null then raise exception 'Nicht angemeldet'; end if;
    select current_holder_id into v_holder from office where id = p_office;

    if v_holder is null then
        -- Vacant: assign immediately to the chosen member (or the caller).
        perform set_config('app.role_transfer', 'on', true);
        update office set current_holder_id = coalesce(p_to, v_caller) where id = p_office;
        update member set role = 'admin' where id = coalesce(p_to, v_caller);
        return null;
    end if;

    if v_caller = v_holder then
        v_from := v_holder; v_to := p_to;
        if v_to is null then raise exception 'Bitte Nachfolger:in wählen'; end if;
    else
        v_from := v_holder; v_to := v_caller;   -- claim
    end if;
    if v_from = v_to then raise exception 'Ungültige Übergabe'; end if;

    update office_transfer set status = 'cancelled', resolved_at = now()
        where office_id = p_office and status = 'pending';
    insert into office_transfer (office_id, from_member_id, to_member_id, initiated_by, status)
        values (p_office, v_from, v_to, v_caller, 'pending')
        returning id into v_id;
    return v_id;
end;
$$;

-- Confirm or decline a pending transfer. Only the party who did NOT initiate may
-- respond. On accept, the holder swaps and roles are adjusted.
create or replace function respond_office_transfer(p_transfer uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare t office_transfer; v_caller uuid; v_counterparty uuid;
begin
    v_caller := current_member_id();
    select * into t from office_transfer where id = p_transfer;
    if t is null or t.status <> 'pending' then raise exception 'Kein offener Antrag'; end if;
    v_counterparty := case when t.initiated_by = t.from_member_id
                           then t.to_member_id else t.from_member_id end;
    if v_caller <> v_counterparty then raise exception 'Nur die Gegenpartei kann bestätigen'; end if;

    if not p_accept then
        update office_transfer set status = 'declined', resolved_at = now() where id = p_transfer;
        return;
    end if;

    perform set_config('app.role_transfer', 'on', true);
    update office set current_holder_id = t.to_member_id where id = t.office_id;
    update member set role = 'admin' where id = t.to_member_id;
    if t.from_member_id is not null
       and not exists (select 1 from office where current_holder_id = t.from_member_id) then
        update member set role = 'member' where id = t.from_member_id;
    end if;
    update office_transfer set status = 'accepted', resolved_at = now() where id = p_transfer;
end;
$$;

-- Reclaim: current holder marks the office kept for a new term (clears reminder).
create or replace function reclaim_office(p_office uuid, p_semester text)
returns void language plpgsql security definer set search_path = public as $$
begin
    if current_member_id() is distinct from (select current_holder_id from office where id = p_office) then
        raise exception 'Nur der/die Amtsinhaber:in kann das Amt behalten';
    end if;
    update office set term_semester = p_semester where id = p_office;
end;
$$;

alter table office          enable row level security;
alter table office_transfer enable row level security;
create policy office_read on office for select to authenticated using (true);
create policy transfer_read on office_transfer for select to authenticated using (true);
-- All writes go through the SECURITY DEFINER functions above (no write policies).

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
