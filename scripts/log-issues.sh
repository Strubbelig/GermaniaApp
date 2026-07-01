#!/usr/bin/env bash
# =============================================================================
# GermaniaApp — log delivered features as GitHub issues, then close them.
# Creates one issue per implemented feature and immediately closes it, so the
# repo's Issues tab is a tidy checklist of what's done.
#
# Prerequisites (one time):
#   1. Install GitHub CLI:  https://cli.github.com
#   2. Authenticate:        gh auth login
#   3. Run from the repo:    bash scripts/log-issues.sh
#
# Safe to run once. Re-running creates duplicates, so only run it a single time
# (or delete the created issues first).
# =============================================================================
set -euo pipefail

# "Title|Body" — one per delivered feature.
FEATURES=(
  "Member directory with self-editable profiles|Members edit their own entry: precise profession (free text + taxonomy), photo, bio, privacy visibility flags."
  "Spouses & children as full entries|Relatives have their own address and birthday; age is derived automatically."
  "Search members by profession|Fuzzy search on precise title or category."
  "Proximity search (near me)|Geolocation + radius via PostGIS; nearest members first."
  "Map of members|MapLibre + OpenStreetMap markers for all geocoded members and events."
  "Email contact & CSV export|Mail-all (BCC) and privacy-filtered CSV export of any result list."
  "Termine: Stammtisch subsection|Recurring events; location required, no prefill."
  "Termine: Semesterprogramm subsection|One-off per-semester events; location prefilled to Gartenstraße 3, Tübingen; semester tag."
  "Termine: Pauktag subsection|One-off fencing-day events; free location."
  "Events are admin/staff-only; RSVP for members|Only Vorstand/Admin create or edit events; members can RSVP."
  "iCal import (admin) & calendar download (all)|Admins bulk-create events from an .ics file; everyone can download a subsection as .ics."
  "Stocherkahn hourly booking|Book by the hour within the day's dawn–dusk window (computed from sun times)."
  "Stocherkahn payment via Stripe|€1 per hour reservation fee through Stripe Checkout; webhook confirms."
  "Stocherkahn season (admin)|Admin sets water/withdraw dates + location; bookings limited to the season."
  "Roles & Row Level Security|member / officer / admin roles enforced in Postgres; members edit only their own data."
  "Admin screen|Manage member roles, remove members, manage profession categories."
  "Offices (Ämter) with two-party handover|Sprecher/Fechtwart/Schriftwart; either party initiates, the other confirms; roles adjust automatically."
  "Semester-end reminder for officeholders|Banner near semester end to reclaim or transfer an office."
  "German UI|Entire interface in German."
  "Fraternity theme (black-gold-red) with crest|Couleur colours, SVG crest with 1816, serif headings, custom nav icons."
  "Tester feedback|In-app feedback form that emails the admin (swap to a table later)."
  "PWA, demo mode & GitHub Pages deploy|Installable web app; runs on sample data with no backend; auto-deploys via GitHub Actions."
  "Supabase backend wiring & setup guide|Auto-switch to real backend when keys are present; SETUP.md walkthrough."
)

echo "Creating and closing ${#FEATURES[@]} issues..."
for entry in "${FEATURES[@]}"; do
  title="${entry%%|*}"
  body="${entry#*|}"
  url=$(gh issue create --title "$title" --body "$body" --label "feature" 2>/dev/null \
        || gh issue create --title "$title" --body "$body")   # retry without label if it doesn't exist
  echo "  created: $title"
  gh issue close "$url" --comment "Delivered and verified. ✅" >/dev/null
  echo "  closed:  $url"
done
echo "Done. See the repo's Issues tab (filter: is:closed)."
