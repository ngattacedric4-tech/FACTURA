// Edge Function: wave-webhook
// Endpoint public appelé par Wave après paiement réussi/échoué.
// Configurer dans le dashboard Wave Business :
//   https://<ref>.supabase.co/functions/v1/wave-webhook
// Vérifie HMAC-SHA256 avec WAVE_WEBHOOK_SECRET.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function verifySignature(secret: string, body: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return expected === signature;
}

Deno.serve(async (req) => {
  const SECRET = Deno.env.get('WAVE_WEBHOOK_SECRET');
  const sig = req.headers.get('Wave-Signature') ?? '';
  const raw = await req.text();

  if (SECRET && !(await verifySignature(SECRET, raw, sig))) {
    return new Response('invalid signature', { status: 401 });
  }

  const event = JSON.parse(raw);
  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Wave envoie type = "checkout.session.completed" / "checkout.session.payment_failed"
  const type = event.type;
  const session = event.data;

  if (!session?.id) return new Response('ok');

  const { data: sub } = await supa
    .from('subscriptions')
    .select('id, company_id, plan')
    .eq('wave_id', session.id)
    .maybeSingle();

  if (!sub) return new Response('subscription not found', { status: 404 });

  if (type === 'checkout.session.completed') {
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    await supa.from('subscriptions').update({
      status: 'active',
      current_period_end: periodEnd.toISOString(),
    }).eq('id', sub.id);
  } else if (type === 'checkout.session.payment_failed') {
    await supa.from('subscriptions').update({ status: 'canceled' }).eq('id', sub.id);
  }

  return new Response('ok');
});
