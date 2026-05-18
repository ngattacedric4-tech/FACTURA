export interface Company {
  id: string;
  user_id: string;
  name: string;
  logo_url?: string;
  ncc?: string;
  registration_number?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  created_at: string;
}

export interface Client {
  id: string;
  company_id: string;
  client_number: string;
  name: string;
  type: 'particulier' | 'entreprise';
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
}

export interface Product {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  unit_price: number;
  unit: string;
  tva_rate: number;
}

export type InvoiceType = 'invoice' | 'estimate';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'canceled' | 'accepted' | 'rejected';

export interface Invoice {
  id: string;
  company_id: string;
  client_id: string;
  type: InvoiceType;
  number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date?: string;
  notes?: string;
  terms?: string;
  subtotal_ht: number;
  total_tva: number;
  total_ttc: number;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  unit?: string;
  tva_rate: number;
  amount_ht: number;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  method: 'wave' | 'om' | 'mtn' | 'cash' | 'transfer' | 'check';
  reference?: string;
  payment_date: string;
}

export interface Subscription {
  id: string;
  company_id: string;
  plan: 'starter' | 'pro' | 'business' | 'enterprise';
  status: 'active' | 'past_due' | 'canceled';
  current_period_end?: string;
}

export type ActivationPlan = 'starter' | 'pro' | 'business' | 'enterprise';

export interface ActivationKey {
  id: string;
  code: string;
  plan: ActivationPlan;
  duration_days: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  used_at?: string;
  used_by_company?: string;
  revoked: boolean;
}

export interface CompanyActivation {
  id: string;
  company_id: string;
  current_key_id?: string;
  plan: ActivationPlan;
  activated_at: string;
  expires_at: string;
  renewed_count: number;
  last_renewed_at?: string;
}
