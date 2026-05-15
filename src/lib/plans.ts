export type PlanId = 'starter' | 'pro' | 'business' | 'enterprise';

export interface PlanLimits {
  invoicesPerMonth: number;
  estimatesPerMonth: number;
  clients: number;
  products: number;
  pdfBrand: boolean;             // peut retirer le watermark FACTURA
  dgiExport: boolean;
  multiUser: number;
  multiCompany: boolean;
  sso: boolean;
  apiAccess: boolean;            // API REST + webhooks
  historyDays: number;           // -1 = illimité
  emailReminders: boolean;       // relances email auto J+3/7/15
  whatsappReminders: boolean;    // relances WhatsApp auto
  recurringInvoices: boolean;    // factures récurrentes
  multiCurrency: boolean;        // EUR/USD en plus du XOF
  advancedDocuments: boolean;    // BC, BL, avoirs
  accountingExports: boolean;    // Sage, Excel
  auditLog: boolean;             // journal d'audit complet
}

const INF = Number.POSITIVE_INFINITY;

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  starter: {
    invoicesPerMonth: 5, estimatesPerMonth: 3,
    clients: 10, products: 20,
    pdfBrand: false, dgiExport: false,
    multiUser: 1, multiCompany: false, sso: false, apiAccess: false,
    historyDays: 30,
    emailReminders: false, whatsappReminders: false,
    recurringInvoices: false, multiCurrency: false,
    advancedDocuments: false, accountingExports: false, auditLog: false,
  },
  pro: {
    invoicesPerMonth: INF, estimatesPerMonth: INF,
    clients: INF, products: INF,
    pdfBrand: true, dgiExport: true,
    multiUser: 1, multiCompany: false, sso: false, apiAccess: false,
    historyDays: -1,
    emailReminders: true, whatsappReminders: false,
    recurringInvoices: false, multiCurrency: false,
    advancedDocuments: false, accountingExports: false, auditLog: false,
  },
  business: {
    invoicesPerMonth: INF, estimatesPerMonth: INF,
    clients: INF, products: INF,
    pdfBrand: true, dgiExport: true,
    multiUser: 5, multiCompany: false, sso: false, apiAccess: true,
    historyDays: -1,
    emailReminders: true, whatsappReminders: true,
    recurringInvoices: true, multiCurrency: true,
    advancedDocuments: true, accountingExports: true, auditLog: false,
  },
  enterprise: {
    invoicesPerMonth: INF, estimatesPerMonth: INF,
    clients: INF, products: INF,
    pdfBrand: true, dgiExport: true,
    multiUser: INF, multiCompany: true, sso: true, apiAccess: true,
    historyDays: -1,
    emailReminders: true, whatsappReminders: true,
    recurringInvoices: true, multiCurrency: true,
    advancedDocuments: true, accountingExports: true, auditLog: true,
  },
};

export const PLAN_LABEL: Record<PlanId, string> = {
  starter: 'Gratuit',
  pro: 'Pro',
  business: 'Business',
  enterprise: 'Enterprise',
};

export const PLAN_PRICE: Record<PlanId, string> = {
  starter: '0 FCFA',
  pro: '5 000 FCFA / mois',
  business: '15 000 FCFA / mois',
  enterprise: 'Sur devis',
};

export function isUnlimited(n: number) {
  return !isFinite(n);
}
