// =============================================================================
// GermaniaApp — Edge Function: ganze-reminders (scheduled, hourly)
// Emails the recipient of a Ganzen that hasn't been reacted to within 1 hour.
// Finds open ganzen older than 60 min with no email yet, emails XX, and stamps
// email_sent_at so each is only nudged once.
//
// Env: RESEND_API_KEY, MAIL_FROM
// Deploy:  supabase functions deploy ganze-reminders --no-verify-jwt
// Schedule it hourly, e.g. with pg_cron:
//   select cron.schedule('ganze-reminders','0 * * * *',
//     $$ select net.http_post('https://<ref>.functions.supabase.co/ganze-reminders',
//         '{}', 'application/json') $$);
// =============================================================================
// @ts-nocheck  (Deno runtime)
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async () => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Open, un-emailed ganze older than an hour, with recipient email.
  const { data: due, error } = await admin
    .from('ganzen')
    .select('id, message, to_member:to_member_id (email, first_name)')
    .eq('status', 'open')
    .is('email_sent_at', null)
    .lt('created_at', cutoff);
  if (error) return new Response(error.message, { status: 500 });

  let sent = 0;
  for (const g of due ?? []) {
    const email = g.to_member?.email;
    if (!email) continue;
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('MAIL_FROM') ?? 'Germania <noreply@germania.app>',
        to: [email],
        subject: 'Dir wurde ein Ganzen zugetrunken!',
        text: `${g.message ?? 'Ein Bundesbruder hat Dir einen Ganzen zugetrunken.'}\n\nBitte tu in der App Bescheid.`,
      }),
    });
    if (resp.ok) {
      await admin.from('ganzen').update({ email_sent_at: new Date().toISOString() }).eq('id', g.id);
      sent++;
    }
  }
  return new Response(JSON.stringify({ reminded: sent }), { headers: { 'Content-Type': 'application/json' } });
});
