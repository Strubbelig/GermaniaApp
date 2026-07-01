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
    date_of_death   date,                       -- set for deceased members (memorial)
    gender          text check (gender in ('female','male','other','undisclosed')),

    email           text not null,
    phone           text,
    website         text,
    photo_url       text,                       -- Supabase Storage object URL
    bio             text,
    trivia          text,                       -- free notes / fun facts (from import)

    member_since    date,
    entry_semester  text,                       -- semester they joined, e.g. 'WS 2016/17'
    fencing_bouts   int not null default 0,     -- number of Fechtpartien (Mensuren)
    -- Verbindungsstatus: fux (on entry) → bursch (after Reception) → philister (after studies)
    corp_status     text not null default 'bursch'
                    check (corp_status in ('fux','bursch','philister')),
    status          text not null default 'active'
                    check (status in ('active','inactive','deceased','pending')),

    -- Opt-in: imported/prefilled members are hidden until they claim their row
    -- (by verified phone) AND opt in. Self-registered members set this to true.
    consented       boolean not null default false,

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

-- Link the signed-in user to a prefilled (imported) member row by VERIFIED phone.
-- Called after phone sign-in: if the user's confirmed phone matches an unclaimed
-- row's phone (digits only), that row becomes theirs. Returns the member id or null.
create or replace function claim_my_member()
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_phone text; v_id uuid;
begin
    v_uid := auth.uid();
    if v_uid is null then return null; end if;
    -- already linked?
    select id into v_id from member where auth_user_id = v_uid;
    if v_id is not null then return v_id; end if;
    -- the user's verified phone (E.164 in auth.users), digits only
    select regexp_replace(coalesce(phone, ''), '\D', '', 'g') into v_phone
        from auth.users where id = v_uid;
    if v_phone is null or v_phone = '' then return null; end if;
    update member set auth_user_id = v_uid
        where auth_user_id is null
          and regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_phone
        returning id into v_id;
    return v_id;   -- null if no match (they register as a brand-new member)
end;
$$;

-- =============================================================================
-- OFFICE HISTORY (Chargen) — a member's past leadership terms (x / xx / xxx)
-- Self-reported; shown under the member's name. Defined here (before the views)
-- so member_directory can aggregate it.
-- =============================================================================
create table office_history (
    id          uuid primary key default gen_random_uuid(),
    member_id   uuid not null references member (id) on delete cascade,
    office_code text not null check (office_code in ('sprecher','fechtwart','schriftwart')),
    semester    text,                           -- e.g. 'WS 2019/20'
    created_at  timestamptz not null default now()
);
create index on office_history (member_id);

alter table office_history enable row level security;
create policy office_history_read on office_history for select to authenticated using (true);
create policy office_history_write on office_history for all to authenticated
    using (member_id = current_member_id())
    with check (member_id = current_member_id());

-- Short abbreviation for an office code (x / xx / xxx).
create or replace function office_abbr(code text)
returns text language sql immutable as $$
    select case code when 'sprecher' then 'x' when 'fechtwart' then 'xx'
                     when 'schriftwart' then 'xxx' else code end;
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
    m.entry_semester,
    m.corp_status,
    m.fencing_bouts,
    (select string_agg(office_abbr(oh.office_code) || ' ' || coalesce(oh.semester, ''), ', '
                       order by oh.semester)
       from office_history oh where oh.member_id = m.id) as charges,
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
       on pc.id = mp.category_id
where m.consented;   -- only opted-in members appear in the directory / map

-- 6a-ii. Deceased members (memorial). Shown regardless of consent — this is
-- curated historical content the society maintains. Includes trivia + lifespan.
create or replace view deceased_directory as
select
    m.id, m.salutation, m.first_name, m.last_name, m.maiden_name,
    m.date_of_birth, m.date_of_death, m.photo_url, m.trivia,
    extract(year from m.date_of_birth)::int as birth_year,
    extract(year from m.date_of_death)::int as death_year,
    mp.title as profession
from member m
left join member_profession mp on mp.member_id = m.id and mp.is_primary
where m.status = 'deceased';

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
    order by 2;   -- order by the full-name column (required with SELECT DISTINCT)
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
-- Others may read a member only if that member has opted in (consented) and is
-- not private. Owners always see their own row; admins see all (policy in ROLES).
create policy member_read on member for select to authenticated
    using (auth_user_id = auth.uid() or (consented and visibility <> 'private'));
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
-- GANZEN  ("Ganzen vor!") — social beer-toast gamification
-- A member (from) drinks a whole beer dedicated to another (to), with before/
-- after photos and the traditional message. The recipient sees it in their
-- inbox and can acknowledge, reciprocate or decline. Stats: leaderboard, drinking
-- partners, and an activity feed.
-- =============================================================================
create table ganzen (
    id               uuid primary key default gen_random_uuid(),
    from_member_id   uuid not null references member (id) on delete cascade,  -- drinker (YY)
    to_member_id     uuid not null references member (id) on delete cascade,  -- addressee (XX)
    message          text,
    before_photo_url text,
    after_photo_url  text,
    reply_to         uuid references ganzen (id) on delete set null,           -- set for reciprocations
    status           text not null default 'open'
                     check (status in ('open','acknowledged','reciprocated','declined')),
    acknowledged_at  timestamptz,
    email_sent_at    timestamptz,                                             -- 1h escalation marker
    created_at       timestamptz not null default now()
);
create index on ganzen (from_member_id);
create index on ganzen (to_member_id, status);
create index on ganzen (created_at);

alter table ganzen enable row level security;
create policy ganzen_read on ganzen for select to authenticated using (true);
create policy ganzen_insert on ganzen for insert to authenticated
    with check (from_member_id = current_member_id());
-- The recipient reacts (acknowledge / decline / mark reciprocated).
create policy ganzen_recipient_update on ganzen for update to authenticated
    using (to_member_id = current_member_id())
    with check (to_member_id = current_member_id());

-- Leaderboard: how many Ganze each member has drunk.
create or replace view ganze_highscore as
select m.id as member_id, (m.first_name || ' ' || m.last_name) as name, count(g.id) as ganze
from member m
join ganzen g on g.from_member_id = m.id
group by m.id, m.first_name, m.last_name
order by count(g.id) desc;

-- Activity feed with both names.
create or replace view ganze_feed as
select g.id, g.created_at, g.message, g.before_photo_url, g.after_photo_url, g.status,
       g.from_member_id, (fm.first_name || ' ' || fm.last_name) as from_name,
       g.to_member_id,   (tm.first_name || ' ' || tm.last_name) as to_name
from ganzen g
join member fm on fm.id = g.from_member_id
join member tm on tm.id = g.to_member_id
order by g.created_at desc;

-- Drinking partners of a member: with whom they've shared the most Ganze.
create or replace function ganze_partners(p_member uuid)
returns table (partner_id uuid, partner_name text, together int)
language sql stable as $$
    select p.id, p.first_name || ' ' || p.last_name, count(*)::int
    from ganzen g
    join member p on p.id = case when g.from_member_id = p_member
                                 then g.to_member_id else g.from_member_id end
    where g.from_member_id = p_member or g.to_member_id = p_member
    group by p.id, p.first_name, p.last_name
    order by count(*) desc;
$$;

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

-- Admins can read, update and ADD any member (incl. non-consented / imported).
create policy member_admin_read on member for select to authenticated
    using (is_admin());
create policy member_admin_update on member for update to authenticated
    using (is_admin()) with check (is_admin());
create policy member_admin_insert on member for insert to authenticated
    with check (is_admin());
-- NOTE: there is deliberately NO member DELETE policy. Removing a member is done
-- only by the database owner (Supabase SQL editor / service role), never through
-- the app — not even by app admins.

-- Admins can write any member's addresses / professions / relatives.
create policy address_admin_write on address for all to authenticated
    using (is_admin()) with check (is_admin());
create policy mp_admin_write on member_profession for all to authenticated
    using (is_admin()) with check (is_admin());
create policy relative_admin_write on relative for all to authenticated
    using (is_admin()) with check (is_admin());
create policy office_history_admin_write on office_history for all to authenticated
    using (is_admin()) with check (is_admin());

-- Admins manage the profession taxonomy.
create policy pc_staff_write on profession_category for all to authenticated
    using (is_admin()) with check (is_admin());

-- Admins create / edit / delete events.
create policy gathering_staff_write on gathering for all to authenticated
    using (is_admin()) with check (is_admin());

-- Admins set the Stocherkahn season and manage any booking.
create policy season_staff_write on stocherkahn_season for all to authenticated
    using (is_admin()) with check (is_admin());
create policy booking_staff_write on stocherkahn_booking for all to authenticated
    using (is_admin()) with check (is_admin());

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
    ('Medizin','medicine', null),
    ('Recht','law', null);
insert into profession_category (name, slug, parent_id)
    select 'Urologie','urology', id from profession_category where slug='medicine';
insert into profession_category (name, slug, parent_id)
    select 'Immobilienrecht','real-estate-law', id from profession_category where slug='law';

-- =============================================================================
-- End of schema
-- =============================================================================
