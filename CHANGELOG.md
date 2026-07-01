# Changelog

All notable changes to GermaniaApp. Newest first. Dates are approximate build dates.

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
