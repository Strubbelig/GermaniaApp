# Germania — society member directory

A mobile-first PWA (vanilla TypeScript + Vite) backed by Supabase, with a path to
RDF/OWL + SPARQL. Members maintain their own entry (profession, family, addresses);
others can search by profession or proximity, view a map, contact by email, export
contact lists, and see recurring gatherings.

## Prototype on GitHub Pages (no backend needed)

The app ships with **demo mode**: when no Supabase credentials are present it runs
entirely in the browser on 10 sample members — perfect for a live preview.

1. Create a new GitHub repository and push this folder to the `main` branch.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) builds and publishes on every
   push. After it finishes, your prototype is live at
   `https://<your-username>.github.io/<repo>/`.

That's it — no Supabase, no sign-in, no keys. Changes you make in demo mode reset on
refresh.

### Push from the command line

```bash
git init
git add .
git commit -m "Germania prototype"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173  (demo mode unless .env is set)
```

## Going live with real data (later)

1. Create a Supabase project; in the SQL editor run, in order:
   `schema.sql` → `supabase/storage.sql` → `supabase/seed.sql`.
2. Deploy the edge functions (`supabase/functions/`, see its README).
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Settings → API) as build
   env in the Pages workflow, or to a local `.env` (copy `.env.example`).
4. In Supabase Auth settings, add your Pages URL to the redirect allow-list, and turn
   on leaked-password protection / MFA.

With credentials present the app automatically switches from demo mode to the real
Supabase backend (sign-in, saving, live data).

## Project layout

```
index.html              app shell
src/main.ts             entry + router + auth gate
src/lib/                supabase client, queries, demo data, api facade, ui helpers
src/screens/            auth, profile, directory (search/map), gatherings
supabase/               schema.sql, storage.sql, seed.sql, functions/
ontology.ttl            OWL ontology + SPARQL (RDF phase)
DATA_MODEL.md           data model docs   ·   ARCHITECTURE.md  system design
```
