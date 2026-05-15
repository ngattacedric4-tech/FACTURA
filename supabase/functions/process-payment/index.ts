// Edge Function: process-payment
// Active l'abonnement après paiement mobile money.
//
// Mode démo (par défaut) : enregistre le paiement et active le plan immédiatement.
// Mode prod : si WAVE_API_KEY est défini, déclenche un Wave Checkout Session
//   et retourne wave_launch_url à rediriger côté client.
//
// Webhook Wave doit pointer vers /functions/v1/wave-webhook pour confirmer
// les paiements asynchrones (voir wave-webhook/index.ts).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PLAN_PRICES: Record<string, number> = {
  pro: 5000,
  business: 15000,
};

interface Body {
  plan: 'pro' | 'business';
  method?: 'wave' | 'om' | 'mtn';
  phone?: string;
  return_url?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = req.headers.get('Authorization');
  if (!auth) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );

  const { data: userData, error: userErr } = await supa.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });
  }
  const userId = userData.user.id;

  const body = await req.json() as Body;
  const amount = PLAN_PRICES[body.plan];
  if (!amount) {
    return new Response(JSON.stringify({ error: 'Invalid plan' }), { status: 400, headers: corsHeaders });
  }

  const { data: company } = await supa
    .from('companies')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!company) {
    return new Response(JSON.stringify({ error: 'No company' }), { status: 400, headers: corsHeaders });
  }

  const WAVE_KEY = Deno.env.get('WAVE_API_KEY');

  // ── Mode production : Wave Checkout réel ─────────────────────────
  if (WAVE_KEY && body.method === 'wave') {
    const transactionRef = `factura_${company.id}_${Date.now()}`;
    const res = await fetch('https://api.wave.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${WAVE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: String(amount),
        currency: 'XOF',
        success_url: body.return_url ?? Deno.env.get('APP_URL') + '/#pricing?status=success',
        error_url: body.return_url ?? Deno.env.get('APP_URL') + '/#pricing?status=error',
        client_reference: transactionRef,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: `Wave error: ${err}` }), { status: 500, headers: corsHeaders });
    }

    const session = await res.json();

    // Enregistre la session en attente — wave-webhook activera le plan à paiement reçu
    await supa.from('subscriptions').upsert({
      company_id: company.id,
      plan: body.plan,
      status: 'past_due',
      wave_id: session.id,
    }, { onConflict: 'company_id' });

    return new Response(
      JSON.stringify({
        wave_launch_url: session.wave_launch_url,
        session_id: session.id,
        mode: 'wave',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // ── Mode démo : active immédiatement ──────────────────────────────
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const { error: subErr } = await supa.from('subscriptions').upsert({
    company_id: company.id,
    plan: body.plan,
    status: 'active',
    current_period_end: periodEnd.toISOString(),
  }, { onConflict: 'company_id' });

  if (subErr) {
    return new Response(JSON.stringify({ error: subErr.message }), { status: 500, headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({ success: true, plan: body.plan, mode: 'demo' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
