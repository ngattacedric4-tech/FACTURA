// Edge Function: send-invite
// Appelée depuis le client pour envoyer un email d'invitation team

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Body {
  member_id: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
  const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'invitations@factura.ci';
  const APP_URL = Deno.env.get('APP_URL') ?? 'https://factura.ci';

  if (!RESEND_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY missing' }), { status: 500, headers: corsHeaders });
  }

  const auth = req.headers.get('Authorization');
  if (!auth) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );

  const { member_id } = await req.json() as Body;

  const { data: member } = await supa
    .from('team_members')
    .select('invited_email, invite_token, role, companies(name)')
    .eq('id', member_id)
    .maybeSingle();

  if (!member?.invited_email || !member.invite_token) {
    return new Response(JSON.stringify({ error: 'invitation introuvable' }), { status: 404, headers: corsHeaders });
  }

  const link = `${APP_URL}/#invite=${member.invite_token}`;
  const companyName = (member.companies as any)?.name ?? 'une entreprise';

  const html = `
    <!DOCTYPE html>
    <html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:24px auto;padding:24px">
      <div style="background:white;padding:32px;border-radius:12px;border:1px solid #e5e7eb">
        <h2 style="color:#0a0a0a">Invitation à rejoindre ${companyName}</h2>
        <p style="color:#374151;font-size:14px;line-height:1.6">
          Vous avez été invité à rejoindre l'équipe <strong>${companyName}</strong> sur FACTURA en tant que <strong>${member.role}</strong>.
        </p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#111827;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
            Accepter l'invitation
          </a>
        </p>
        <p style="color:#6b7280;font-size:12px">Ou copiez ce lien : ${link}</p>
      </div>
    </body></html>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: member.invited_email,
      subject: `Invitation à rejoindre ${companyName} sur FACTURA`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(JSON.stringify({ error: err }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
