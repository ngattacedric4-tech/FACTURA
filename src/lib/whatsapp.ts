import { Invoice } from '@/types/database';
import { formatAmount } from '@/lib/documentTypes';

interface ReminderArgs {
  invoice: Invoice;
  clientPhone: string;
  clientName: string;
  companyName: string;
  customMessage?: string;
}

export function buildWhatsappReminderUrl({ invoice, clientPhone, clientName, companyName, customMessage }: ReminderArgs): string {
  const phone = clientPhone.replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (!phone) return '';

  const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('fr-FR') : '';
  const amount = formatAmount(invoice.total_ttc, (invoice.currency ?? 'XOF') as any);

  const defaultMsg = `Bonjour ${clientName},

Petit rappel concernant la facture *${invoice.number}* d'un montant de *${amount}*${dueDate ? ` (échéance : ${dueDate})` : ''} qui reste à régler.

Merci de procéder au paiement dès que possible.

Cordialement,
${companyName}`;

  const text = customMessage?.trim() || defaultMsg;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
