# Importing the member list from Excel

You can pre-load everyone's data (phone, address, trivia, …) from your Excel file.
Imported members are **hidden and unclaimed**: nobody sees them until that person
signs in, proves the phone number in your file is theirs (SMS code), and opts in.
Deceased members are the exception — they appear in the **Verstorbene** tab as
memorial entries.

## How the opt-in / prefill flow works

1. You import the Excel list → each person becomes a hidden row
   (`consented = false`, not linked to any login).
2. A member installs the app and **signs in with their phone number**; Supabase
   sends an SMS code. Entering the correct code proves they own that number.
3. On first load the app calls `claim_my_member()`, which links the row whose phone
   matches their verified number. Their profile is now **prefilled** with the
   imported data.
4. They flip the **"Auf der App sichtbar sein"** opt-in toggle. Only then do other
   members see them.

If the phone doesn't match any imported row, they simply register as a new member.

## Step 1 — generate the SQL (on your computer)

```bash
npm install xlsx
node scripts/import-members.mjs "path/to/members.xlsx"      # optionally: "SheetName"
```

Before running, open `scripts/import-members.mjs` and edit `COLUMN_MAP` so the
right-hand strings match **your** spreadsheet's exact column headers, e.g.:

```js
const COLUMN_MAP = {
  first_name: 'Vorname',
  last_name:  'Nachname',
  phone:      'Handy',        // <- whatever your header is
  ...
};
```

Notes:
- `phone` is the **claim key** — use each person's own mobile, ideally in
  international form (`+49170…`). Matching ignores spaces and punctuation.
- The `Verstorben` column: any non-empty value marks the row as deceased.
- Missing birthdate defaults to `1900-01-01` (it's a required field); fix later.

This writes `supabase/members_import.sql`.

## Step 2 — load it

Open the file, skim it, then paste it into the **Supabase SQL editor** and run it
(after `schema.sql`). Re-running it would create duplicates, so run once.

## Step 3 — phone sign-in (one-time Supabase setup)

Phone claiming needs an SMS provider. In Supabase → **Authentication → Providers →
Phone**, enable it and connect a provider (e.g. Twilio / MessageBird). Without this,
members can still sign in by email, but automatic prefill-by-phone won't trigger.

## Privacy

Keep the generated `supabase/members_import.sql` and the Excel file **out of the
git repo** (they contain real personal data). `.gitignore` already excludes common
cases; double-check before committing.
