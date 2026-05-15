// Edge Function: generate-recurring
// Schedule: 1 fois par jour
// Génère les factures depuis les modèles récurrents arrivés à échéance
// Réservé aux plans Business+ (vérifié sur la company)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Template {
  id: string;
  company_id: string;
  client_id: string | null;
  client_name: string | null;
  name: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  next_date: string;
  items: Array<{ description: string; quantity: number; unit_price: number; tva_rate?: number }>;
  notes?: string;
}

function nextDate(from: Date, freq: Template['frequency']): Date {
  const d = new Date(from);
  switch (freq) {
    case 'weekly':    d.setUTCDate(d.getUTCDate() + 7); break;
    case 'monthly':   d.setUTCMonth(d.getUTCMonth() + 1); break;
    case 'quarterly': d.setUTCMonth(d.getUTCMonth() + 3); break;
    case 'yearly':    d.setUTCFullYear(d.getUTCFullYear() + 1); break;
  }
  return d;
}

async function nextInvoiceNumber(supa: any, companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const { data, count } = await supa
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('type', 'invoice')
    .gte('created_at', `${year}-01-01`);
  const seq = (count ?? 0) + 1;
  return `FAC-${year}-${String(seq).padStart(4, '0')}`;
}

Deno.serve(async () => {
  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const { data: templates, error } = await supa
    .from('recurring_templates')
    .select('*')
    .eq('active', true)
    .lte('next_date', todayStr)
    .returns<Template[]>();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let generated = 0;
  let skipped = 0;

  for (const tpl of templates ?? []) {
    if (!tpl.client_id) { skipped++; continue; }

    // Vérifier plan Business+
    const { data: sub } = await supa
      .from('subscriptions')
      .select('plan')
      .eq('company_id', tpl.company_id)
      .maybeSingle();

    if (!sub || !['business', 'enterprise'].includes(sub.plan)) {
      skipped++;
      continue;
    }

    const subtotal = tpl.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const tva = tpl.items.reduce((s, i) => s + i.quantity * i.unit_price * ((i.tva_rate ?? 18) / 100), 0);
    const ttc = subtotal + tva;
    const number = await nextInvoiceNumber(supa, tpl.company_id);

    const dueDate = new Date(today);
    dueDate.setUTCDate(dueDate.getUTCDate() + 30);

    const { data: inv, error: invErr } = await supa
      .from('invoices')
      .insert({
        company_id: tpl.company_id,
        client_id: tpl.client_id,
        type: 'invoice',
        number,
        status: 'sent',
        issue_date: todayStr,
        due_date: dueDate.toISOString().slice(0, 10),
        notes: tpl.notes,
        subtotal_ht: subtotal,
        total_tva: tva,
        total_ttc: ttc,
      })
      .select('id')
      .single();

    if (invErr || !inv) { skipped++; continue; }

    if (tpl.items.length > 0) {
      await supa.from('invoice_items').insert(
        tpl.items.map(i => ({
          invoice_id: inv.id,
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
          tva_rate: i.tva_rate ?? 18,
        })),
      );
    }

    const newNext = nextDate(new Date(tpl.next_date), tpl.frequency);
    await supa
      .from('recurring_templates')
      .update({
        next_date: newNext.toISOString().slice(0, 10),
        last_generated_at: new Date().toISOString(),
      })
      .eq('id', tpl.id);

    generated++;
  }

  return new Response(
    JSON.stringify({ generated, skipped, run_at: new Date().toISOString() }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
