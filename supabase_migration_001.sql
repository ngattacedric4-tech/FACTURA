-- MIGRATION 001: align schema with TypeScript types + DGI compliance
-- Run after supabase_schema.sql. Idempotent where possible.

BEGIN;

-- 1. Fix client.type enum (TS uses 'particulier'/'entreprise', SQL had 'particular'/'company')
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_type_check;
UPDATE public.clients SET type = 'particulier' WHERE type = 'particular';
UPDATE public.clients SET type = 'entreprise' WHERE type = 'company';
ALTER TABLE public.clients
    ADD CONSTRAINT clients_type_check CHECK (type IN ('particulier', 'entreprise'));

-- 2. Add MTN MoMo to payment methods
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE public.payments
    ADD CONSTRAINT payments_method_check
    CHECK (method IN ('wave', 'om', 'mtn', 'cash', 'transfer', 'check'));

-- 3. Add tax id (NCC) column to clients (DGI requirement for B2B invoicing)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ncc TEXT;

-- 4. Sequential invoice numbering per company per year (DGI requirement)
CREATE TABLE IF NOT EXISTS public.invoice_counters (
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    year INT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('invoice', 'estimate')),
    last_number INT NOT NULL DEFAULT 0,
    PRIMARY KEY (company_id, year, type)
);

ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their company's counters" ON public.invoice_counters
    FOR ALL
    USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()))
    WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

-- Atomic next-number RPC. Call from client: supabase.rpc('next_invoice_number', { p_company_id, p_type })
CREATE OR REPLACE FUNCTION public.next_invoice_number(p_company_id UUID, p_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_year INT := EXTRACT(YEAR FROM CURRENT_DATE);
    v_next INT;
    v_prefix TEXT;
BEGIN
    -- Authorization check: caller must own the company
    IF NOT EXISTS (
        SELECT 1 FROM public.companies
        WHERE id = p_company_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF p_type NOT IN ('invoice', 'estimate') THEN
        RAISE EXCEPTION 'Invalid type: %', p_type;
    END IF;

    INSERT INTO public.invoice_counters (company_id, year, type, last_number)
    VALUES (p_company_id, v_year, p_type, 1)
    ON CONFLICT (company_id, year, type)
    DO UPDATE SET last_number = invoice_counters.last_number + 1
    RETURNING last_number INTO v_next;

    v_prefix := CASE WHEN p_type = 'invoice' THEN 'FAC' ELSE 'DEV' END;
    RETURN v_prefix || '-' || v_year || '-' || LPAD(v_next::TEXT, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_invoice_number(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(UUID, TEXT) TO authenticated;

-- 5. Tighten RLS with explicit WITH CHECK (prevent cross-company writes)
DROP POLICY IF EXISTS "Users can only access their own company" ON public.companies;
CREATE POLICY "Users can only access their own company" ON public.companies
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only access their company's clients" ON public.clients;
CREATE POLICY "Users can only access their company's clients" ON public.clients
    FOR ALL
    USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()))
    WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can only access their company's products" ON public.products;
CREATE POLICY "Users can only access their company's products" ON public.products
    FOR ALL
    USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()))
    WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can only access their company's invoices" ON public.invoices;
CREATE POLICY "Users can only access their company's invoices" ON public.invoices
    FOR ALL
    USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()))
    WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can only access their company's invoice items" ON public.invoice_items;
CREATE POLICY "Users can only access their company's invoice items" ON public.invoice_items
    FOR ALL
    USING (invoice_id IN (SELECT id FROM public.invoices WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())))
    WITH CHECK (invoice_id IN (SELECT id FROM public.invoices WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS "Users can only access their company's payments" ON public.payments;
CREATE POLICY "Users can only access their company's payments" ON public.payments
    FOR ALL
    USING (invoice_id IN (SELECT id FROM public.invoices WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())))
    WITH CHECK (invoice_id IN (SELECT id FROM public.invoices WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS "Users can only access their company's sub" ON public.subscriptions;
CREATE POLICY "Users can only access their company's sub" ON public.subscriptions
    FOR ALL
    USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()))
    WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

-- 6. Indexes for common filters
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON public.invoices(issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(company_id, name);

COMMIT;
