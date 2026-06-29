// =============================================================================
// GermaniaApp — Edge Function: stripe-webhook
// Stripe calls this after a payment. It verifies the signature, then on
// `checkout.session.completed` marks the booking paid + confirmed. This is the
// trusted source of payment truth (never the browser).
//
// Env: STRIPE_WEBHOOK_SECRET
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
//   (Stripe can't send a Supabase JWT; we verify Stripe's own signature instead.)
// In Stripe: add a webhook endpoint -> this function URL, event
//   checkout.session.completed, and copy the signing secret to STRIPE_WEBHOOK_SECRET.
// =============================================================================
// @ts-nocheck  (Deno runtime)
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const enc = new TextEncoder();

// Verify Stripe's `t=...,v1=...` signature header (HMAC-SHA256 of `t.payload`).
async function verify(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const t = parts['t'];
  const v1 = parts['v1'];
  if (!t || !v1) return false;
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${payload}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  // constant-time-ish compare
  if (hex.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

serve(async (req: Request) => {
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

  if (!(await verify(payload, sig, secret))) {
    return new Response('Bad signature', { status: 400 });
  }

  const event = JSON.parse(payload);
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookingId = session.metadata?.booking_id ?? session.client_reference_id;
    if (bookingId) {
      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      await admin
        .from('stocherkahn_booking')
        .update({
          payment_status: 'paid',
          status: 'confirmed',
          stripe_payment_intent_id: session.payment_intent ?? null,
        })
        .eq('id', bookingId);
    }
  }

  return new Response('ok', { status: 200 });
});
