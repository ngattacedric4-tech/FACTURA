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

export type InvoiceType = 'invoice' | 'estimate' | 'purchase_order' | 'delivery_note' | 'credit_note';
export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'canceled' | 'accepted' | 'rejected';
export type Currency = 'XOF' | 'EUR' | 'USD';

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
  currency?: Currency;
  exchange_rate?: number;
  parent_invoice_id?: string;
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

export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface TeamMember {
  id: string;
  company_id: string;
  user_id: string | null;
  role: TeamRole;
  invited_email: string | null;
  invited_at: string;
  accepted_at: string | null;
  invite_token: string | null;
  invited_by: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  company_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  before_data: any;
  after_data: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface ApiKey {
  id: string;
  company_id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface Webhook {
  id: string;
  company_id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
}
