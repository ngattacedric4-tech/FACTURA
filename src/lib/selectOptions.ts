export interface SelectOption {
  label: string;
  value: string;
}

export const CLIENT_TYPE_OPTIONS: SelectOption[] = [
  { label: 'Entreprise', value: 'entreprise' },
  { label: 'Particulier', value: 'particulier' },
];

export const INVOICE_STATUS_OPTIONS: SelectOption[] = [
  { label: 'Brouillon', value: 'draft' },
  { label: 'Envoyé', value: 'sent' },
  { label: 'Payé', value: 'paid' },
  { label: 'En retard', value: 'overdue' },
  { label: 'Annulé', value: 'canceled' },
];

export const PAYMENT_METHOD_OPTIONS: SelectOption[] = [
  { label: 'Wave', value: 'wave' },
  { label: 'Orange Money', value: 'om' },
  { label: 'MTN Money', value: 'mtn' },
  { label: 'Espèces', value: 'cash' },
  { label: 'Virement bancaire', value: 'transfer' },
  { label: 'Chèque', value: 'check' },
];

export const TVA_OPTIONS: SelectOption[] = [
  { label: '0% (Exonéré)', value: '0' },
  { label: '18% (Standard DGI)', value: '18' },
];

export const PRODUCT_UNIT_OPTIONS: SelectOption[] = [
  { label: 'Unité', value: 'unite' },
  { label: 'Forfait', value: 'forfait' },
  { label: 'Heure', value: 'heure' },
  { label: 'Jour', value: 'jour' },
  { label: 'Mois', value: 'mois' },
  { label: 'Kg', value: 'kg' },
  { label: 'Litre', value: 'litre' },
  { label: 'Mètre', value: 'metre' },
];

export const PAYMENT_TERMS_OPTIONS: SelectOption[] = [
  { label: 'À réception', value: '0' },
  { label: '15 jours', value: '15' },
  { label: '30 jours', value: '30' },
  { label: '45 jours', value: '45' },
  { label: 'Personnalisé', value: 'custom' },
];
