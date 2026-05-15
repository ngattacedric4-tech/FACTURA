// Edge Function: send-reminders
// Schedule: tous les jours à 09:00 UTC (configurer dans Supabase Cron)
// Env vars requises:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY (https://resend.com)
//   FROM_EMAIL (ex: relances@factura.ci)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REMINDER_DAYS = [3, 7, 15];

interface Invoice {
  id: string;
  company_id: string;
  number: string;
  total_ttc: number;
  due_date: string;
  currency?: string;
  clients: { name: string; email: string | null } | null;
  companies: { name: string; email: string | null; plan?: string } | null;
}

function buildEmailHtml(inv: Invoice, daysOverdue: number, message: string): string {
  const clientName = inv.clients?.name ?? 'Cher client';
  const companyName = inv.companies?.name ?? 'Notre équipe';
  const amount = `${inv.total_ttc.toLocaleString('fr-FR')} ${inv.currency ?? 'XOF'}`;
  const customMsg = message?.trim()
    ? `<p style="color:#374151;font-size:14px;line-height:1.6">${message}</p>`
    : '';
  return `
    <!DOCTYPE html>
    <html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:24px auto;padding:24px;background:#fafafa">
      <div style="background:white;padding:32px;border-radius:12px;border:1px solid #e5e7eb">
        <h2 style="color:#0a0a0a;margin:0 0 16px 0">Rappel de paiement</h2>
        <p style="color:#374151;font-size:14px;line-height:1.6">Bonjour ${clientName},</p>
        <p style="color:#374151;font-size:14px;line-height:1.6">
          Nous vous rappelons que la facture <strong>${inv.number}</strong> d'un montant de
          <strong>${amount}</strong> est en retard de paiement de <strong>${daysOverdue} jours</strong>
          (échéance : ${new Date(inv.due_date).toLocaleDateString('fr-FR')}).
        </p>
        ${customMsg}
        <p style="color:#374151;font-size:14px;line-height:1.6">
          Merci de procéder au règlement dès que possible.
        </p>
        <p style="color:#6b7280;font-size:12px;margin-top:24px">
          Cordialement,<br/>${companyName}
        </p>
      </div>
      <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:16px">
        Email automatique envoyé via FACTURA
      </p>
    </body></html>
  `;
}

async function sendEmail(to: string, subject: string, html: string, from: string, apiKey: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend ${res.status}: ${err}`);
  }
  return res.json();
}

Deno.serve(async () => {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
  const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'relances@factura.ci';

  if (!RESEND_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY missing' }), { status: 500 });
  }

  const supa = createClient(SUPABASE_URL, SERVICE_KEY);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const days of REMINDER_DAYS) {
    const target = new Date(today);
    target.setUTCDate(target.getUTCDate() - days);
    const targetStr = target.toISOString().slice(0, 10);

    // Factures dont la date d'échéance est exactement target
    const { data: invoices, error } = await supa
      .from('invoices')
      .select(`
        id, company_id, number, total_ttc, due_date, currency,
        clients ( name, email ),
        companies ( name, email )
      `)
      .eq('type', 'invoice')
      .eq('status', 'sent')
      .eq('due_date', targetStr)
      .returns<Invoice[]>();

    if (error) {
      console.error('Query error', error);
      continue;
    }

    for (const inv of invoices ?? []) {
      // Vérifier plan de la company (Pro+ pour relances email)
      const { data: sub } = await supa
        .from('subscriptions')
        .select('plan')
        .eq('company_id', inv.company_id)
        .maybeSingle();

      if (!sub || !['pro', 'business', 'enterprise'].includes(sub.plan)) {
        skipped++;
        continue;
      }

      // Vérifier paramètres automation
      const { data: settings } = await supa
        .from('automation_settings')
        .select('reminders_enabled, reminder_message')
        .eq('company_id', inv.company_id)
        .maybeSingle();

      if (!settings?.reminders_enabled) {
        skipped++;
        continue;
      }

      // Anti-doublon
      const { data: existingLog } = await supa
        .from('reminder_logs')
        .select('id')
        .eq('invoice_id', inv.id)
        .eq('channel', 'email')
        .eq('days_after_due', days)
        .maybeSingle();

      if (existingLog) {
        skipped++;
        continue;
      }

      const clientEmail = inv.clients?.email;
      if (!clientEmail) {
        await supa.from('reminder_logs').insert({
          invoice_id: inv.id,
          company_id: inv.company_id,
          channel: 'email',
          days_after_due: days,
          success: false,
          error_message: 'Client sans email',
        });
        failed++;
        continue;
      }

      try {
        const html = buildEmailHtml(inv, days, settings.reminder_message ?? '');
        await sendEmail(
          clientEmail,
          `Rappel : facture ${inv.number} en attente`,
          html,
          FROM_EMAIL,
          RESEND_KEY,
        );

        await supa.from('reminder_logs').insert({
          invoice_id: inv.id,
          company_id: inv.company_id,
          channel: 'email',
          days_after_due: days,
          success: true,
        });
        sent++;
      } catch (e) {
        await supa.from('reminder_logs').insert({
          invoice_id: inv.id,
          company_id: inv.company_id,
          channel: 'email',
          days_after_due: days,
          success: false,
          error_message: String(e),
        });
        failed++;
      }
    }
  }

  return new Response(
    JSON.stringify({ sent, skipped, failed, run_at: new Date().toISOString() }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
