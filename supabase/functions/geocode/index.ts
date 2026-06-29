// =============================================================================
// GermaniaApp — Edge Function: geocode
// Turns a postal address into { lat, lon } so address.geo (PostGIS) can be set.
// Uses OpenStreetMap Nominatim — free, no API key (good fit for "works on old
// phones / no vendor lock-in"). Respect its usage policy: identify yourself with
// a real contact in NOMINATIM_EMAIL, and don't exceed ~1 request/second.
//
// Deploy:  supabase functions deploy geocode
// Called from the app via supabase.functions.invoke('geocode', { body }).
// =============================================================================
// @ts-nocheck  (Deno runtime; types resolve at deploy time, not in the web build)
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const CONTACT = Deno.env.get('NOMINATIM_EMAIL') ?? 'admin@germania.app';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AddressParts {
  street?: string;
  house_number?: string;
  postal_code?: string;
  city?: string;
  region?: string;
  country_code?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const a: AddressParts = await req.json();

    const street = [a.house_number, a.street].filter(Boolean).join(' ');
    const params = new URLSearchParams({ format: 'jsonv2', limit: '1', addressdetails: '0' });
    if (street) params.set('street', street);
    if (a.city) params.set('city', a.city);
    if (a.region) params.set('state', a.region);
    if (a.postal_code) params.set('postalcode', a.postal_code);
    if (a.country_code) params.set('countrycodes', a.country_code.toLowerCase());

    const res = await fetch(`${NOMINATIM}?${params.toString()}`, {
      headers: { 'User-Agent': `GermaniaApp/1.0 (${CONTACT})` },
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);

    const hits = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (hits.length === 0) {
      return new Response(JSON.stringify(null), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { lat, lon } = hits[0];
    return new Response(JSON.stringify({ lat: Number(lat), lon: Number(lon) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
