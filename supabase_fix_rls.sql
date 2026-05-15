-- ====================================================================
-- FIX RLS — récursion infinie team_members
-- À exécuter dans Supabase SQL Editor
-- ====================================================================

-- 1) Fonctions helper SECURITY DEFINER (bypass RLS, lecture brute)
CREATE OR REPLACE FUNCTION public.user_company_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.companies WHERE user_id = auth.uid()
  UNION
  SELECT company_id FROM public.team_members
  WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.user_admin_company_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.companies WHERE user_id = auth.uid()
  UNION
  SELECT company_id FROM public.team_members
  WHERE user_id = auth.uid() AND role IN ('owner','admin') AND accepted_at IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.user_company_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_company_ids() TO authenticated;
REVOKE ALL ON FUNCTION public.user_admin_company_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_admin_company_ids() TO authenticated;

-- 2) team_members : policies sans auto-référence
DROP POLICY IF EXISTS "team_members select" ON public.team_members;
DROP POLICY IF EXISTS "team_members insert" ON public.team_members;
DROP POLICY IF EXISTS "team_members update" ON public.team_members;
DROP POLICY IF EXISTS "team_members delete" ON public.team_members;

CREATE POLICY "team_members select" ON public.team_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

CREATE POLICY "team_members insert" ON public.team_members
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

CREATE POLICY "team_members update" ON public.team_members
  FOR UPDATE USING (
    user_id = auth.uid()
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

CREATE POLICY "team_members delete" ON public.team_members
  FOR DELETE USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- 3) RLS clients/products/invoices/etc : utiliser la fonction
DROP POLICY IF EXISTS "Users can only access their company's clients" ON public.clients;
CREATE POLICY "Users can only access their company's clients" ON public.clients
  FOR ALL USING (company_id IN (SELECT public.user_company_ids()));

DROP POLICY IF EXISTS "Users can only access their company's products" ON public.products;
CREATE POLICY "Users can only access their company's products" ON public.products
  FOR ALL USING (company_id IN (SELECT public.user_company_ids()));

DROP POLICY IF EXISTS "Users can only access their company's invoices" ON public.invoices;
CREATE POLICY "Users can only access their company's invoices" ON public.invoices
  FOR ALL USING (company_id IN (SELECT public.user_company_ids()));

DROP POLICY IF EXISTS "Users can only access their company's invoice items" ON public.invoice_items;
CREATE POLICY "Users can only access their company's invoice items" ON public.invoice_items
  FOR ALL USING (
    invoice_id IN (
      SELECT id FROM public.invoices WHERE company_id IN (SELECT public.user_company_ids())
    )
  );

DROP POLICY IF EXISTS "Users can only access their company's payments" ON public.payments;
CREATE POLICY "Users can only access their company's payments" ON public.payments
  FOR ALL USING (
    invoice_id IN (
      SELECT id FROM public.invoices WHERE company_id IN (SELECT public.user_company_ids())
    )
  );

DROP POLICY IF EXISTS "Users can only access their company's sub" ON public.subscriptions;
CREATE POLICY "Users can only access their company's sub" ON public.subscriptions
  FOR ALL USING (company_id IN (SELECT public.user_company_ids()));

DROP POLICY IF EXISTS "automation_settings access" ON public.automation_settings;
CREATE POLICY "automation_settings access" ON public.automation_settings
  FOR ALL USING (company_id IN (SELECT public.user_company_ids()));

DROP POLICY IF EXISTS "reminder_logs access" ON public.reminder_logs;
CREATE POLICY "reminder_logs access" ON public.reminder_logs
  FOR ALL USING (company_id IN (SELECT public.user_company_ids()));

DROP POLICY IF EXISTS "recurring_templates access" ON public.recurring_templates;
CREATE POLICY "recurring_templates access" ON public.recurring_templates
  FOR ALL USING (company_id IN (SELECT public.user_company_ids()));

DROP POLICY IF EXISTS "document_sequences access" ON public.document_sequences;
CREATE POLICY "document_sequences access" ON public.document_sequences
  FOR ALL USING (company_id IN (SELECT public.user_company_ids()));

DROP POLICY IF EXISTS "api_keys access" ON public.api_keys;
CREATE POLICY "api_keys access" ON public.api_keys
  FOR ALL USING (company_id IN (SELECT public.user_admin_company_ids()));

DROP POLICY IF EXISTS "webhooks access" ON public.webhooks;
CREATE POLICY "webhooks access" ON public.webhooks
  FOR ALL USING (company_id IN (SELECT public.user_admin_company_ids()));

DROP POLICY IF EXISTS "audit_logs access" ON public.audit_logs;
CREATE POLICY "audit_logs access" ON public.audit_logs
  FOR SELECT USING (company_id IN (SELECT public.user_admin_company_ids()));

-- 4) Vérification
DO $$
DECLARE
  rec_count INT;
BEGIN
  SELECT COUNT(*) INTO rec_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname IN (
      'team_members select','team_members insert','team_members update','team_members delete',
      'Users can only access their company''s clients',
      'Users can only access their company''s invoices'
    );
  RAISE NOTICE 'Policies recréées : %', rec_count;
END $$;
