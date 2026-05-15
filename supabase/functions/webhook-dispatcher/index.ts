// Edge Function: webhook-dispatcher
// Schedule: toutes les minutes (cron)
// Vide la file webhook_queue et POST chaque event vers l'URL configurée
// Signature HMAC-SHA256 dans header X-Factura-Signature

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_BATCH = 50;
const MAX_RETRIES = 5;

interface QueueItem {
  id: string;
  webhook_id: string;
  event: string;
  payload: any;
  attempts: number;
  webhooks: { url: string; secret: string | null; active: boolean };
}

async function hmacSha256(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async () => {
  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: queue } = await supa
    .from('webhook_queue')
    .select('id, webhook_id, event, payload, attempts, webhooks(url, secret, active)')
    .is('delivered_at', null)
    .lt('attempts', MAX_RETRIES)
    .order('created_at')
    .limit(MAX_BATCH)
    .returns<QueueItem[]>();

  if (!queue || queue.length === 0) {
    return new Response(JSON.stringify({ delivered: 0 }), { headers: { 'Content-Type': 'application/json' } });
  }

  let delivered = 0;
  let failed = 0;

  for (const item of queue) {
    if (!item.webhooks?.active) {
      await supa.from('webhook_queue').update({ delivered_at: new Date().toISOString() }).eq('id', item.id);
      continue;
    }

    const body = JSON.stringify({
      event: item.event,
      data: item.payload,
      delivered_at: new Date().toISOString(),
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Factura-Event': item.event,
      'User-Agent': 'Factura-Webhooks/1.0',
    };

    if (item.webhooks.secret) {
      headers['X-Factura-Signature'] = await hmacSha256(item.webhooks.secret, body);
    }

    let status = 0;
    let respBody = '';
    try {
      const res = await fetch(item.webhooks.url, { method: 'POST', headers, body });
      status = res.status;
      respBody = (await res.text()).slice(0, 500);
    } catch (e) {
      respBody = String(e);
    }

    await supa.from('webhook_deliveries').insert({
      webhook_id: item.webhook_id,
      event: item.event,
      payload: item.payload,
      status_code: status,
      response_body: respBody,
    });

    if (status >= 200 && status < 300) {
      await supa.from('webhook_queue').update({
        delivered_at: new Date().toISOString(),
        attempts: item.attempts + 1,
      }).eq('id', item.id);
      delivered++;
    } else {
      await supa.from('webhook_queue').update({ attempts: item.attempts + 1 }).eq('id', item.id);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ delivered, failed, batch_size: queue.length }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
