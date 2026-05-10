export type PlanId = 'starter' | 'pro' | 'business' | 'enterprise';

export interface PlanLimits {
  invoicesPerMonth: number;
  estimatesPerMonth: number;
  clients: number;
  products: number;
  pdfBrand: boolean;        // peut retirer le watermark FACTURA
  dgiExport: boolean;
  multiUser: number;
  multiCompany: boolean;
  sso: boolean;
  apiAccess: boolean;
  historyDays: number;      // -1 = illimité
  aiWhatsappAgent: boolean; // agent IA qui répond aux clients via WhatsApp
  aiInsights: boolean;      // analyses prédictives (impayés, opportunités)
}

const INF = Number.POSITIVE_INFINITY;

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  starter: {
    invoicesPerMonth: 5, estimatesPerMonth: 3,
    clients: 10, products: 20,
    pdfBrand: false, dgiExport: false,
    multiUser: 1, multiCompany: false, sso: false, apiAccess: false,
    historyDays: 30,
    aiWhatsappAgent: false, aiInsights: false,
  },
  pro: {
    invoicesPerMonth: INF, estimatesPerMonth: INF,
    clients: INF, products: INF,
    pdfBrand: true, dgiExport: true,
    multiUser: 1, multiCompany: false, sso: false, apiAccess: false,
    historyDays: -1,
    aiWhatsappAgent: false, aiInsights: false,
  },
  business: {
    invoicesPerMonth: INF, estimatesPerMonth: INF,
    clients: INF, products: INF,
    pdfBrand: true, dgiExport: true,
    multiUser: 5, multiCompany: false, sso: false, apiAccess: false,
    historyDays: -1,
    aiWhatsappAgent: true, aiInsights: true,
  },
  enterprise: {
    invoicesPerMonth: INF, estimatesPerMonth: INF,
    clients: INF, products: INF,
    pdfBrand: true, dgiExport: true,
    multiUser: INF, multiCompany: true, sso: true, apiAccess: true,
    historyDays: -1,
    aiWhatsappAgent: true, aiInsights: true,
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
