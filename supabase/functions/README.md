# Edge Functions

Server-side helpers that keep API keys off the phone.

| Function | Purpose | Secrets needed |
|---|---|---|
| `geocode` | Address → `{ lat, lon }` (OpenStreetMap Nominatim, no key) | `NOMINATIM_EMAIL` (contact, recommended) |
| `send-email` | Privacy-preserving member-to-member email (BCC) via Resend | `RESEND_API_KEY`, `MAIL_FROM` |
| `create-checkout` | Stripe Checkout session for a booking's €1 fee | `STRIPE_SECRET_KEY` |
| `stripe-webhook` | Confirms payment → marks booking paid/confirmed | `STRIPE_WEBHOOK_SECRET` |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected
automatically by the platform.

## Deploy

```bash
supabase functions deploy geocode
supabase functions deploy send-email
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook --no-verify-jwt

# set secrets (once)
supabase secrets set NOMINATIM_EMAIL=you@example.org
supabase secrets set RESEND_API_KEY=re_xxx MAIL_FROM="Germania <noreply@yourdomain>"
supabase secrets set STRIPE_SECRET_KEY=sk_xxx STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### Stripe setup (for the Stocherkahn €1 fee)

1. Create a Stripe account; copy your secret key into `STRIPE_SECRET_KEY`.
2. In Stripe → Developers → Webhooks, add an endpoint pointing at the deployed
   `stripe-webhook` URL, subscribe to `checkout.session.completed`, and copy the
   signing secret into `STRIPE_WEBHOOK_SECRET`.
3. The €1 amount is read from the booking server-side, so the client can't change it.
   In demo mode there is no Stripe — payment is simulated.

## Notes

- **geocode** respects Nominatim's free-tier policy (~1 req/sec, identify yourself).
  For higher volume, swap the endpoint for a paid geocoder (Mapbox, Google, LocationIQ) —
  only this file changes; the data layer is unaffected.
- **send-email** takes recipient *member IDs*, not raw emails, and resolves addresses
  server-side through `member_contact_export` so a hidden email can never leak. For simple
  cases the client-side `mailtoFor()` helper (opens the user's own mail app) needs no
  function at all.
- The `// @ts-nocheck` at the top of each file is intentional: these run on Deno, whose
  remote-URL imports don't resolve in the Vite/TypeScript web build.
