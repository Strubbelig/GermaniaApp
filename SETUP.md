# Going live with a real backend — step by step

This takes the app from the throwaway demo to a real, shared database where members
create accounts and their data persists. Follow the parts in order. **Part A + B are
enough** for a working real app (profiles, search, map, events, admin). Parts C–D add
address geocoding, in-app email, and the €1 Stocherkahn payment — you can do them later.

Time: ~30–45 minutes for A + B.

Legend: 🧑 = you must do it (needs your accounts); everything else is already coded.

---

## Part A — Create the Supabase database

1. 🧑 Go to <https://supabase.com>, sign up (free), and click **New project**.
   - Pick a name (e.g. `germania`), a strong database password (save it), and a region
     close to your members (e.g. Frankfurt).
   - Wait ~2 minutes for it to finish provisioning.

2. 🧑 In the project, open **SQL Editor** (left sidebar) → **New query**. Then run the
   three files from this repo **in this order**, one at a time (paste contents → **Run**):
   1. `schema.sql`  (tables, security rules, search functions, roles)
   2. `supabase/storage.sql`  (photo storage bucket)
   3. `supabase/seed.sql`  (the 10 sample members — optional; skip if you want to start empty)

   Each should report success. If `schema.sql` complains that an extension isn't
   available, that's rare on Supabase — tell me and I'll adjust.

3. 🧑 Open **Project Settings → API** and copy two values (keep this tab open):
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long token labelled `anon` / `public`)

   > The **anon** key is safe to expose — it's meant for browsers and is limited by the
   > security rules. Do **not** copy the `service_role` key anywhere public.

---

## Part B — Connect the live site to it

1. 🧑 In your **GitHub repo → Settings → Secrets and variables → Actions → New repository
   secret**, add two secrets:
   - Name `VITE_SUPABASE_URL`  → value = the Project URL from A3
   - Name `VITE_SUPABASE_ANON_KEY`  → value = the anon key from A3

2. 🧑 Configure sign-in redirects: in Supabase **Authentication → URL Configuration**, set
   - **Site URL** = your Pages address, `https://<your-name>.github.io/<repo>/`
   - add the same address under **Redirect URLs**.

3. 🧑 (Recommended) In **Authentication → Providers → Email**, keep email enabled; under
   **Authentication → Policies / Protection**, turn on **leaked password protection**.

4. 🧑 Trigger a redeploy: GitHub repo → **Actions** → the “Deploy to GitHub Pages” workflow
   → **Run workflow** (or just push any small change).

That's it. Because the build now has the keys, the app automatically switches from demo
mode to the real backend. Open your Pages URL: you'll get a real **sign-in screen**, and
anything you save persists and is shared across everyone.

> **First admin:** sign up once with your own email. Then in Supabase → **Table Editor →
> `member`**, find your row and set `role` to `admin` (or, if you loaded the seed and
> signed up as a fresh person, promote yourself from the in-app Admin screen once any
> admin exists). After that you can manage roles from inside the app.

---

## Part C — Address geocoding & in-app email (optional)

These run as Supabase **Edge Functions**. You'll need the Supabase CLI once
(<https://supabase.com/docs/guides/cli>), then:

```bash
supabase login
supabase link --project-ref <your-project-ref>     # ref is in the project URL
supabase functions deploy geocode
supabase functions deploy send-email
supabase secrets set NOMINATIM_EMAIL=you@example.org
supabase secrets set RESEND_API_KEY=re_xxx MAIL_FROM="Germania <noreply@yourdomain>"
```

- `geocode` turns typed addresses into map pins (free OpenStreetMap; no key, just a
  contact email). Without it, members can still enter addresses — they just won't get a
  map pin until geocoded.
- `send-email` is optional; the app already offers plain “email” links that open the
  member's own mail app without any function.

---

## Part D — Stocherkahn €1 payment via Stripe (optional)

1. 🧑 Create a **Stripe** account (<https://stripe.com>). Start in **test mode**.
2. Deploy the two functions and set the keys:

   ```bash
   supabase functions deploy create-checkout
   supabase functions deploy stripe-webhook --no-verify-jwt
   supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
   ```

3. 🧑 In Stripe → **Developers → Webhooks → Add endpoint**: URL = the deployed
   `stripe-webhook` function URL, event = `checkout.session.completed`. Copy the signing
   secret and run:

   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```

4. Test a booking end-to-end with a Stripe **test card** (`4242 4242 4242 4242`, any
   future expiry/CVC). Switch Stripe to live mode only when you're ready to take real €1.

---

## After going live — housekeeping

- **Make the repo private** if you'll store real member data (needs GitHub Pro for Pages
  from a private repo). Keep `seed.sql` fake regardless.
- **Never commit** the `service_role` key, Stripe secret key, or real personal data.
- To go back to demo mode anytime, remove the two GitHub secrets and redeploy.

## If something breaks

- Live site still shows demo banner → the two GitHub secrets aren't set, or the workflow
  ran before they were added. Re-run the workflow.
- Sign-in link goes nowhere → Site URL / Redirect URLs in Supabase Auth don't match your
  Pages address exactly (including the trailing `/<repo>/`).
- SQL error on run → tell me the exact message; the files are ordered so `schema.sql`
  must run first.
