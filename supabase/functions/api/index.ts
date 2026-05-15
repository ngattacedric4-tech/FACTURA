// Edge Function: api
// REST API publique authentifiée par clé API (table api_keys)
// Routes :
//   GET    /api/v1/invoices               (liste)
//   POST   /api/v1/invoices               (créer)
//   GET    /api/v1/invoices/:id           (détail)
//   PATCH  /api/v1/invoices/:id           (modif partielle)
//   DELETE /api/v1/invoices/:id           (supprimer)
//   GET    /api/v1/clients                (liste)
//   POST   /api/v1/clients                (créer)
//   GET    /api/v1/products               (liste)
//   POST   /api/v1/products               (créer)
//   GET    /api/v1/payments               (liste)
//   POST   /api/v1/payments               (créer)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

async function hashKey(raw: string): Promise<string> {
  const buf = new TextEncoder().encode(raw);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function authenticate(req: Request, supa: any): Promise<{ company_id: string } | null> {
  let raw: string | null = req.headers.get('x-api-key');
  if (!raw) {
    const auth = req.headers.get('authorization');
    if (auth?.toLowerCase().startsWith('bearer ')) raw = auth.slice(7);
  }
  if (!raw || !raw.startsWith('fac_')) return null;

  const hash = await hashKey(raw);
  const { data: key } = await supa
    .from('api_keys')
    .select('company_id, revoked_at')
    .eq('key_hash', hash)
    .maybeSingle();

  if (!key || key.revoked_at) return null;

  await supa.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('key_hash', hash);
  return { company_id: key.company_id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  // Path après /functions/v1/api : ex /v1/invoices/:id
  const pathParts = url.pathname.split('/').filter(Boolean);
  const apiIdx = pathParts.indexOf('api');
  const route = pathParts.slice(apiIdx + 1);

  if (route[0] !== 'v1') return jsonResponse({ error: 'Use /v1/* endpoints' }, 404);

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const auth = await authenticate(req, supa);
  if (!auth) return jsonResponse({ error: 'Invalid or missing API key' }, 401);

  const { company_id } = auth;
  const resource = route[1];
  const id = route[2];

  // Plan check : Business+ requis
  const { data: sub } = await supa.from('subscriptions').select('plan').eq('company_id', company_id).maybeSingle();
  if (!sub || !['business', 'enterprise'].includes(sub.plan)) {
    return jsonResponse({ error: 'API access requires Business plan or higher' }, 403);
  }

  try {
    if (resource === 'invoices') {
      if (req.method === 'GET' && !id) {
        const status = url.searchParams.get('status');
        const type = url.searchParams.get('type') ?? 'invoice';
        const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200);
        let q = supa.from('invoices').select('*, clients(*), invoice_items(*), payments(*)')
          .eq('company_id', company_id).eq('type', type).order('created_at', { ascending: false }).limit(limit);
        if (status) q = q.eq('status', status);
        const { data, error } = await q;
        if (error) throw error;
        return jsonResponse({ data });
      }

      if (req.method === 'GET' && id) {
        const { data, error } = await supa.from('invoices')
          .select('*, clients(*), invoice_items(*), payments(*)')
          .eq('id', id).eq('company_id', company_id).single();
        if (error) return jsonResponse({ error: error.message }, 404);
        return jsonResponse({ data });
      }

      if (req.method === 'POST' && !id) {
        const body = await req.json();
        const items = body.items ?? [];
        const subtotal = items.reduce((s: number, i: any) => s + (i.quantity ?? 1) * (i.unit_price ?? 0), 0);
        const tva = items.reduce((s: number, i: any) => s + (i.quantity ?? 1) * (i.unit_price ?? 0) * ((i.tva_rate ?? 18) / 100), 0);

        const docType = body.type ?? 'invoice';
        const prefix = ({ invoice: 'FAC', estimate: 'DEV', purchase_order: 'BC', delivery_note: 'BL', credit_note: 'AV' } as any)[docType] ?? 'FAC';
        const { data: numData } = await supa.rpc('next_document_number', {
          p_company_id: company_id, p_doc_type: docType, p_prefix: prefix,
        });

        const { data: inv, error: invErr } = await supa.from('invoices').insert({
          company_id,
          client_id: body.client_id,
          type: docType,
          number: numData,
          status: body.status ?? 'draft',
          issue_date: body.issue_date ?? new Date().toISOString().slice(0, 10),
          due_date: body.due_date,
          notes: body.notes,
          terms: body.terms,
          subtotal_ht: subtotal,
          total_tva: tva,
          total_ttc: subtotal + tva,
          currency: body.currency ?? 'XOF',
        }).select().single();
        if (invErr) return jsonResponse({ error: invErr.message }, 400);

        if (items.length > 0) {
          await supa.from('invoice_items').insert(items.map((i: any) => ({
            invoice_id: inv.id,
            description: i.description ?? '',
            quantity: i.quantity ?? 1,
            unit_price: i.unit_price ?? 0,
            tva_rate: i.tva_rate ?? 18,
            unit: i.unit ?? 'unité',
          })));
        }

        return jsonResponse({ data: inv }, 201);
      }

      if (req.method === 'PATCH' && id) {
        const body = await req.json();
        delete body.id; delete body.company_id; delete body.number;
        const { data, error } = await supa.from('invoices')
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq('id', id).eq('company_id', company_id).select().single();
        if (error) return jsonResponse({ error: error.message }, 400);
        return jsonResponse({ data });
      }

      if (req.method === 'DELETE' && id) {
        await supa.from('invoice_items').delete().eq('invoice_id', id);
        const { error } = await supa.from('invoices').delete().eq('id', id).eq('company_id', company_id);
        if (error) return jsonResponse({ error: error.message }, 400);
        return jsonResponse({ deleted: id });
      }
    }

    if (resource === 'clients') {
      if (req.method === 'GET') {
        const { data } = await supa.from('clients').select('*').eq('company_id', company_id).order('name');
        return jsonResponse({ data });
      }
      if (req.method === 'POST') {
        const body = await req.json();
        const { count } = await supa.from('clients').select('id', { count: 'exact', head: true }).eq('company_id', company_id);
        const num = `CLI-${String((count ?? 0) + 1).padStart(4, '0')}`;
        const { data, error } = await supa.from('clients').insert({
          company_id,
          client_number: num,
          name: body.name,
          type: body.type ?? 'entreprise',
          email: body.email,
          phone: body.phone,
          address: body.address,
          tax_id: body.tax_id ?? body.ncc,
        }).select().single();
        if (error) return jsonResponse({ error: error.message }, 400);
        return jsonResponse({ data }, 201);
      }
    }

    if (resource === 'products') {
      if (req.method === 'GET') {
        const { data } = await supa.from('products').select('*').eq('company_id', company_id).order('name');
        return jsonResponse({ data });
      }
      if (req.method === 'POST') {
        const body = await req.json();
        const { data, error } = await supa.from('products').insert({
          company_id,
          name: body.name,
          description: body.description,
          unit_price: body.unit_price ?? 0,
          unit: body.unit ?? 'unité',
          tva_rate: body.tva_rate ?? 18,
        }).select().single();
        if (error) return jsonResponse({ error: error.message }, 400);
        return jsonResponse({ data }, 201);
      }
    }

    if (resource === 'payments') {
      if (req.method === 'GET') {
        const { data } = await supa.from('payments')
          .select('*, invoices!inner(company_id, number)')
          .eq('invoices.company_id', company_id)
          .order('payment_date', { ascending: false });
        return jsonResponse({ data });
      }
      if (req.method === 'POST') {
        const body = await req.json();
        // Vérifie que la facture appartient bien à la company
        const { data: inv } = await supa.from('invoices').select('id').eq('id', body.invoice_id).eq('company_id', company_id).maybeSingle();
        if (!inv) return jsonResponse({ error: 'Invoice not found' }, 404);
        const { data, error } = await supa.from('payments').insert({
          invoice_id: body.invoice_id,
          amount: body.amount,
          method: body.method ?? 'transfer',
          reference: body.reference,
          payment_date: body.payment_date ?? new Date().toISOString(),
        }).select().single();
        if (error) return jsonResponse({ error: error.message }, 400);
        return jsonResponse({ data }, 201);
      }
    }

    return jsonResponse({ error: `Route not found: ${req.method} /${route.join('/')}` }, 404);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
