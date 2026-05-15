import { InvoiceType } from '@/types/database';

export const DOC_TYPE_META: Record<InvoiceType, {
  label: string;
  shortLabel: string;
  prefix: string;
  numberWord: string;
  requiresPlan?: 'business' | 'enterprise';
}> = {
  invoice:        { label: 'Facture',           shortLabel: 'Facture', prefix: 'FAC', numberWord: 'Facture' },
  estimate:       { label: 'Devis',             shortLabel: 'Devis',   prefix: 'DEV', numberWord: 'Devis' },
  purchase_order: { label: 'Bon de commande',   shortLabel: 'B.C.',    prefix: 'BC',  numberWord: 'Bon de commande', requiresPlan: 'business' },
  delivery_note:  { label: 'Bon de livraison',  shortLabel: 'B.L.',    prefix: 'BL',  numberWord: 'Bon de livraison', requiresPlan: 'business' },
  credit_note:    { label: 'Avoir',             shortLabel: 'Avoir',   prefix: 'AV',  numberWord: 'Avoir', requiresPlan: 'business' },
};

export const CURRENCIES: Record<'XOF' | 'EUR' | 'USD', { symbol: string; label: string }> = {
  XOF: { symbol: 'FCFA', label: 'Franc CFA (XOF)' },
  EUR: { symbol: '€',    label: 'Euro (EUR)' },
  USD: { symbol: '$',    label: 'Dollar US (USD)' },
};

export function formatAmount(amount: number, currency: 'XOF' | 'EUR' | 'USD' = 'XOF'): string {
  const formatted = amount.toLocaleString('fr-FR', { minimumFractionDigits: currency === 'XOF' ? 0 : 2, maximumFractionDigits: 2 });
  const sym = CURRENCIES[currency].symbol;
  return currency === 'XOF' ? `${formatted} ${sym}` : `${sym}${formatted}`;
}
