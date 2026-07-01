# Changelog

## [0.8.0] — Permission model tightened — 2026-07

### Changed
- **Members** can read everything but only write their own profile (+ family,
  Chargen), send Ganze, and book the Stocherkahn.
- **Content management is admin-only** (was officer+admin): creating/deleting
  events, setting the Stocherkahn season, managing the profession taxonomy, and
  managing any booking.
- Admin tab and event creation are gated on `is_admin`.

### Added
- Admins can **add members** (new "Mitglied hinzufügen" form + `member_admin_insert`
  policy).
- Migration `supabase/migrations/0001_tighten_permissions.sql` to apply the policy
  changes to an existing database.

### Removed
- No app path to **delete a member** — not even for admins. Member deletion is
  database-owner-only (Supabase SQL editor / service role). Dropped
  `member_admin_delete` and the delete button in the admin screen.

### Fixed
- Auth redirect now targets the app's full path (`/GermaniaApp/`), not the domain
  root, so magic/reset links land on the app.
- `members_by_profession` SELECT DISTINCT ordering; `seed.sql` uuid cast;
  re-runnable `storage.sql`.


## [0.7.1] — All-male roster + Verbindungsstatus — 2026-07

### Changed
- Demo and seed members are now all men (an all-male Verbindung); spouses/children
  remain as they are. All profession/city/bio strings are German.

### Added
- **Verbindungsstatus** on every member — Fux (on entry) → Aktiver Bursch (after
  Reception) → Philister (after studies) — editable in the profile and shown as a
  badge on the name tag in the directory.


All notable changes to GermaniaApp. Newest first. Dates are approximate build dates.

## [0.7.0] — Chargen, Fechtpartien, "Ganzen vor!" — 2026-07

### Added
- **Chargen (Ämtergeschichte):** members record past x/xx/xxx terms with the semester;
  shown in gold under their name in the directory (`office_history`).
- **Fechtpartien:** a Mensuren count per member, shown with crossed student swords.
- **Eintrittssemester:** required semester-of-joining field on every profile.
- **"Ganzen vor!" gamification:** a button under each member; a disclaimer with a
  before/after photo (Supabase Storage) and a decline option
  ("Ich bin phrittig und kann nichts am Glas!"). The toast message lands in the
  recipient's Postfach; they can acknowledge or decline. Stats: Bestenliste (most
  Ganze), Trinkpartner (with whom you drank most), and a Verlauf feed. Email
  escalation after 1h of no reaction via the scheduled `ganze-reminders` function.
- Bottom navigation is now horizontally scrollable to fit the new sections.

## [0.6.0] — Member import, opt-in consent, deceased tab — 2026-07

### Added
- **Excel import** (`scripts/import-members.mjs`): generate SQL from your .xlsx
  (phone, address, trivia, …) into hidden, unclaimed member rows. Guide: `IMPORT.md`.
- **Opt-in consent:** imported/prefilled members are hidden from everyone until they
  claim their row and opt in. New `consented` flag; directory, search, map and RLS all
  respect it. Self-registered members are visible by default.
- **Claim by verified phone:** `claim_my_member()` links a signed-in user to the
  prefilled row whose phone matches their SMS-verified number (needs a Supabase SMS
  provider). Profile then shows an "Auf der App sichtbar sein" opt-in toggle.
- **Trivia** field on every member.
- **Verstorbene (deceased) tab:** memorial view of deceased members with lifespan and
  trivia, shown regardless of consent (`date_of_death`, `deceased_directory` view).

## [0.5.0] — Offices, event subsections, per-hour boat — 2026-07

### Added
- **Ämter (offices):** Sprecher, Fechtwart and Schriftwart, each holding admin rights.
  Two-party handover — either the current holder or the incoming member starts it and
  the other confirms; on acceptance the holder swaps, the new holder becomes admin, and
  the outgoing holder drops to `member` unless they hold another office. Vacant offices
  can be claimed. Enforced by SECURITY DEFINER functions with a role-guard bypass.
- **Semester-end reminder:** banner for officeholders in the ~4 weeks before semester end
  (WS → 31 Mar, SS → 30 Sep) prompting them to reclaim or transfer. Email planned once
  the backend + scheduled tasks are live.
- **Termine split into subsections:** Stammtisch (recurring, location required, no
  prefill), Semesterprogramm (one-off per semester, location prefilled to
  Gartenstraße 3, Tübingen, with a semester tag) and Pauktag (one-off, free location).
- **iCal:** admin-only `.ics` import to bulk-create events; `.ics` calendar download for
  every user (per subsection).
- **Stocherkahn is now hourly:** book by the hour within the day's dawn–dusk window;
  fee is €1 per hour; overlapping bookings rejected by a database exclusion constraint.

### Changed
- Event creation/editing is now **staff-only** (Vorstand/Admin); members can view, RSVP
  and download the calendar.
- Office holders (3 seats) are seeded as admins.

## [0.4.0] — Couleur theme, German UI, feedback

### Added
- **Fraternity theme:** black-gold-red Couleur (black at the bottom), SVG crest with
  crossed Stocherkahn poles and "1816", serif display headings, gold hairlines, custom
  nav icons, tricolour header band.
- **Tester feedback** button (emails the admin; swappable to a form/table later).

### Changed
- **Entire UI translated to German.**

## [0.3.0] — Admin roles

### Added
- Roles `member` / `officer` / `admin` with additive Row Level Security; admin-only
  `set_member_role` RPC; trigger preventing self role-escalation.
- Admin screen: manage member roles, remove members, manage profession categories.

## [0.2.0] — Stocherkahn booking + GitHub Pages prototype

### Added
- **Stocherkahn:** admin-set season (water/withdraw dates + location), booking with
  dawn/dusk computed from sun times, €1 Stripe payment (edge functions
  `create-checkout` + `stripe-webhook`).
- **Demo mode:** in-memory sample data (10 members) so the app runs with no backend.
- **GitHub Pages deploy** via GitHub Actions; PWA shell (installable, offline).

## [0.1.0] — Foundation

### Added
- Data model (Supabase/PostgreSQL): members, addresses (PostGIS), professions
  (precise + taxonomy), relatives (with own address + birthday/age), gatherings.
- Member self-service profile editor; directory; search by profession; proximity
  search; map (MapLibre + OpenStreetMap); email contact; privacy-filtered CSV export.
- Secure sign-in (Supabase Auth: magic link + password); auth gate; bottom navigation.
- Edge functions: `geocode`, `send-email`. Storage bucket for member photos.
- RDF/OWL ontology + SPARQL (reusing FOAF, vCard, ORG, GeoSPARQL, schema.org, ESCO)
  as the target for a later RDF phase.
- Docs: `DATA_MODEL.md`, `ARCHITECTURE.md`, `README.md`, `SETUP.md`.
