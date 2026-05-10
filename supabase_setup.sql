-- SETUP COMPLET FACTURA.CI — schéma final aligné avec types TS
-- À exécuter dans Supabase SQL Editor (idempotent — peut être ré-exécuté)

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES

CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    logo_url TEXT,
    ncc TEXT,
    registration_number TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_company UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    client_number TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    tax_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_type_check;
UPDATE public.clients SET type = 'particulier' WHERE type = 'particular';
UPDATE public.clients SET type = 'entreprise' WHERE type = 'company';
ALTER TABLE public.clients ADD CONSTRAINT clients_type_check CHECK (type IN ('particulier', 'entreprise'));

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    unit TEXT DEFAULT 'unité',
    tva_rate NUMERIC(5, 2) DEFAULT 18.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id),
    type TEXT CHECK (type IN ('invoice', 'estimate')),
    number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    notes TEXT,
    terms TEXT,
    subtotal_ht NUMERIC(15, 2) DEFAULT 0,
    total_tva NUMERIC(15, 2) DEFAULT 0,
    total_ttc NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(15, 2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    unit TEXT DEFAULT 'unité',
    tva_rate NUMERIC(5, 2) DEFAULT 18.00,
    amount_ht NUMERIC(15, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'unité';

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL,
    method TEXT,
    reference TEXT,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_method_check
  CHECK (method IN ('wave', 'om', 'mtn', 'cash', 'transfer', 'check'));

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    plan TEXT CHECK (plan IN ('starter', 'business', 'pro')) DEFAULT 'starter',
    status TEXT CHECK (status IN ('active', 'past_due', 'canceled')) DEFAULT 'active',
    current_period_end TIMESTAMP WITH TIME ZONE,
    wave_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. RLS
ALTER TABLE public.companies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions  ENABLE ROW LEVEL SECURITY;

-- Policies (drop+create = idempotent)
DROP POLICY IF EXISTS "Users can only access their own company" ON public.companies;
CREATE POLICY "Users can only access their own company" ON public.companies
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only access their company's clients" ON public.clients;
CREATE POLICY "Users can only access their company's clients" ON public.clients
    FOR ALL USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can only access their company's products" ON public.products;
CREATE POLICY "Users can only access their company's products" ON public.products
    FOR ALL USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can only access their company's invoices" ON public.invoices;
CREATE POLICY "Users can only access their company's invoices" ON public.invoices
    FOR ALL USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can only access their company's invoice items" ON public.invoice_items;
CREATE POLICY "Users can only access their company's invoice items" ON public.invoice_items
    FOR ALL USING (invoice_id IN (SELECT id FROM public.invoices WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS "Users can only access their company's payments" ON public.payments;
CREATE POLICY "Users can only access their company's payments" ON public.payments
    FOR ALL USING (invoice_id IN (SELECT id FROM public.invoices WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS "Users can only access their company's sub" ON public.subscriptions;
CREATE POLICY "Users can only access their company's sub" ON public.subscriptions
    FOR ALL USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_companies_user        ON public.companies(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_company       ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company      ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status       ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice      ON public.payments(invoice_id);

-- 5. STORAGE bucket logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read logos" ON storage.objects;
CREATE POLICY "Public read logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "Authenticated upload logos" ON storage.objects;
CREATE POLICY "Authenticated upload logos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos');

DROP POLICY IF EXISTS "Authenticated update logos" ON storage.objects;
CREATE POLICY "Authenticated update logos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'logos');
