// Edge Function: daily-purge
// Schedule: 1 fois par jour (configurer dans Supabase Cron)
// Supprime les factures/devis de plus de 30 jours pour les comptes plan starter
// Pro+ : historique illimité, rien à purger

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const cutoffStr = cutoff.toISOString();

  // Companies sur plan starter
  const { data: starters } = await supa
    .from('subscriptions')
    .select('company_id')
    .eq('plan', 'starter');

  if (!starters || starters.length === 0) {
    return new Response(JSON.stringify({ purged: 0, companies: 0 }));
  }

  const ids = starters.map(s => s.company_id);

  const { data: deleted, error } = await supa
    .from('invoices')
    .delete()
    .in('company_id', ids)
    .lt('created_at', cutoffStr)
    .select('id');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(
    JSON.stringify({
      purged: deleted?.length ?? 0,
      companies: ids.length,
      cutoff: cutoffStr,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
