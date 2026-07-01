// =============================================================================
// GermaniaApp — Edge Function: send-email
// Lets a signed-in member contact other members in-app WITHOUT exposing their
// addresses. The caller sends recipient MEMBER IDs (not raw emails); the
// function resolves emails server-side, honouring each recipient's show_email
// flag, then sends via Resend. Recipients go in BCC so addresses stay private.
//
// Env:  RESEND_API_KEY, MAIL_FROM (e.g. "Germania <noreply@germania.app>")
// Deploy:  supabase functions deploy send-email
//
// Note: a simpler alternative is the client-side mailtoFor() helper, which opens
// the member's own mail app. Use this function only when you want true in-app
// sending / privacy-preserving BCC.
// =============================================================================
// @ts-nocheck  (Deno runtime)
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Payload {
  toMemberIds: string[];
  subject: string;
  text: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1. Authenticate the caller from their JWT.
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) {
      return json({ error: 'Not authenticated' }, 401);
    }

    const { toMemberIds, subject, text }: Payload = await req.json();
    if (!toMemberIds?.length || !subject || !text) {
      return json({ error: 'toMemberIds, subject and text are required' }, 400);
    }

    // 2. Resolve recipient emails with the SERVICE ROLE, honouring show_email
    //    (member_contact_export already nulls email when show_email = false).
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: rows, error } = await admin
      .from('member_contact_export')
      .select('email')
      .in('member_id', toMemberIds);
    if (error) throw new Error(error.message);

    const emails = (rows ?? []).map((r) => r.email).filter(Boolean) as string[];
    if (emails.length === 0) {
      return json({ error: 'No reachable recipients (they may have hidden their email).' }, 422);
    }

    // 3. Send via Resend (reply-to set to the sender so replies reach them).
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('MAIL_FROM') ?? 'Germania <noreply@germania.app>',
        bcc: emails,
        reply_to: userData.user.email,
        subject,
        text,
      }),
    });
    if (!resp.ok) throw new Error(`Resend ${resp.status}: ${await resp.text()}`);

    return json({ sent: emails.length });
  } catch (err) {
    return json({ error: String(err) }, 400);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
