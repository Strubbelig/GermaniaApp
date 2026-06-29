// =============================================================================
// GermaniaApp — Edge Function: create-checkout
// Creates a Stripe Checkout Session for a booking's €1 reservation fee and
// returns its URL. The caller (a signed-in member) passes the booking id; the
// amount/currency are read server-side from the booking, never trusted from the
// client. The session id is stored on the booking; payment is confirmed later
// by the stripe-webhook function.
//
// Env: STRIPE_SECRET_KEY
// Deploy: supabase functions deploy create-checkout
// =============================================================================
// @ts-nocheck  (Deno runtime)
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { booking_id, success_url, cancel_url } = await req.json();
    if (!booking_id) return json({ error: 'booking_id required' }, 400);

    // Authenticate caller.
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return json({ error: 'Not authenticated' }, 401);

    // Read the booking with the service role (amount is authoritative here).
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: booking, error } = await admin
      .from('stocherkahn_booking')
      .select('id, fee_cents, currency, booking_date')
      .eq('id', booking_id)
      .single();
    if (error || !booking) return json({ error: 'Booking not found' }, 404);

    // Create the Checkout Session via Stripe's REST API (form-encoded).
    const body = new URLSearchParams();
    body.set('mode', 'payment');
    body.set('success_url', success_url ?? 'https://example.com/success');
    body.set('cancel_url', cancel_url ?? 'https://example.com/cancel');
    body.set('client_reference_id', booking.id);
    body.set('metadata[booking_id]', booking.id);
    body.set('line_items[0][quantity]', '1');
    body.set('line_items[0][price_data][currency]', booking.currency);
    body.set('line_items[0][price_data][unit_amount]', String(booking.fee_cents));
    body.set('line_items[0][price_data][product_data][name]', `Stocherkahn reservation ${booking.booking_date}`);

    const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const session = await resp.json();
    if (!resp.ok) return json({ error: session.error?.message ?? 'Stripe error' }, 400);

    await admin
      .from('stocherkahn_booking')
      .update({ stripe_session_id: session.id })
      .eq('id', booking.id);

    return json({ url: session.url });
  } catch (err) {
    return json({ error: String(err) }, 400);
  }
});

function json(b: unknown, status = 200): Response {
  return new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
