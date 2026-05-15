-- ====================================================================
-- FACTURA — Migration features payantes (Phases 1-4)
-- À exécuter dans Supabase SQL Editor (idempotent)
-- ====================================================================

-- ====================================================================
-- PHASE 1 — Automatisations Pro
-- ====================================================================

-- Paramètres d'automatisation par entreprise
CREATE TABLE IF NOT EXISTS public.automation_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    reminders_enabled BOOLEAN DEFAULT false,
    reminder_days_after_due INTEGER DEFAULT 7,
    reminder_message TEXT,
    whatsapp_reminders_enabled BOOLEAN DEFAULT false,
    whatsapp_reminder_template TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_automation_company UNIQUE(company_id)
);

ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "automation_settings access" ON public.automation_settings;
CREATE POLICY "automation_settings access" ON public.automation_settings
  FOR ALL USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

-- Logs d'envoi de relances (anti-doublon)
CREATE TABLE IF NOT EXISTS public.reminder_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    channel TEXT CHECK (channel IN ('email','whatsapp')) NOT NULL,
    days_after_due INTEGER NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT now(),
    success BOOLEAN DEFAULT true,
    error_message TEXT
);

ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reminder_logs access" ON public.reminder_logs;
CREATE POLICY "reminder_logs access" ON public.reminder_logs
  FOR ALL USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_reminder_logs_invoice ON public.reminder_logs(invoice_id, channel, days_after_due);

-- ====================================================================
-- PHASE 2 — Multi-utilisateurs / RBAC
-- ====================================================================

-- Table membres d'équipe (relation n:n user-company avec rôle)
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner','admin','member','viewer')),
    invited_email TEXT,
    invited_at TIMESTAMPTZ DEFAULT now(),
    accepted_at TIMESTAMPTZ,
    invite_token TEXT,
    invited_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_member UNIQUE(company_id, user_id),
    CONSTRAINT unique_invite UNIQUE(company_id, invited_email)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Policies sans auto-référence (sinon récursion infinie)
DROP POLICY IF EXISTS "team_members select" ON public.team_members;
CREATE POLICY "team_members select" ON public.team_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "team_members insert" ON public.team_members;
CREATE POLICY "team_members insert" ON public.team_members
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "team_members update" ON public.team_members;
CREATE POLICY "team_members update" ON public.team_members
  FOR UPDATE USING (
    user_id = auth.uid()
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "team_members delete" ON public.team_members;
CREATE POLICY "team_members delete" ON public.team_members
  FOR DELETE USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- Helper functions SECURITY DEFINER pour éviter récursion via team_members
CREATE OR REPLACE FUNCTION public.user_company_ids()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT id FROM public.companies WHERE user_id = auth.uid()
  UNION
  SELECT company_id FROM public.team_members WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.user_admin_company_ids()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT id FROM public.companies WHERE user_id = auth.uid()
  UNION
  SELECT company_id FROM public.team_members
  WHERE user_id = auth.uid() AND role IN ('owner','admin') AND accepted_at IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.user_company_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_company_ids() TO authenticated;
REVOKE ALL ON FUNCTION public.user_admin_company_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_admin_company_ids() TO authenticated;

CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_company ON public.team_members(company_id);
CREATE INDEX IF NOT EXISTS idx_team_members_token ON public.team_members(invite_token) WHERE invite_token IS NOT NULL;

-- Auto-créer team_member 'owner' à création d'une company
CREATE OR REPLACE FUNCTION public.auto_create_owner_team_member()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.team_members (company_id, user_id, role, accepted_at, invited_by)
  VALUES (NEW.id, NEW.user_id, 'owner', now(), NEW.user_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS auto_owner_team_member ON public.companies;
CREATE TRIGGER auto_owner_team_member
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_owner_team_member();

-- Backfill: créer team_member 'owner' pour les companies existantes
INSERT INTO public.team_members (company_id, user_id, role, accepted_at, invited_by)
SELECT c.id, c.user_id, 'owner', now(), c.user_id
FROM public.companies c
LEFT JOIN public.team_members tm ON tm.company_id = c.id AND tm.user_id = c.user_id
WHERE tm.id IS NULL;

-- Étendre les RLS existantes pour inclure les team members
-- (les owners gardent accès, les members gagnent l'accès via team_members)
DROP POLICY IF EXISTS "Users can only access their company's clients" ON public.clients;
CREATE POLICY "Users can only access their company's clients" ON public.clients
  FOR ALL USING (
    company_id IN (SELECT public.user_company_ids())
  );

DROP POLICY IF EXISTS "Users can only access their company's products" ON public.products;
CREATE POLICY "Users can only access their company's products" ON public.products
  FOR ALL USING (
    company_id IN (SELECT public.user_company_ids())
  );

DROP POLICY IF EXISTS "Users can only access their company's invoices" ON public.invoices;
CREATE POLICY "Users can only access their company's invoices" ON public.invoices
  FOR ALL USING (
    company_id IN (SELECT public.user_company_ids())
  );

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
  FOR ALL USING (
    company_id IN (SELECT public.user_company_ids())
  );

-- ====================================================================
-- PHASE 3 — Documents avancés Business
-- ====================================================================

-- Étendre type document : invoice, estimate, purchase_order, delivery_note, credit_note
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_type_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_type_check
  CHECK (type IN ('invoice', 'estimate', 'purchase_order', 'delivery_note', 'credit_note'));

-- Avoirs : référence à la facture d'origine
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS parent_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;

-- Multi-devises
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'XOF';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(15, 6) DEFAULT 1;

-- Modèles récurrents
CREATE TABLE IF NOT EXISTS public.recurring_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    client_name TEXT,
    name TEXT NOT NULL,
    frequency TEXT CHECK (frequency IN ('weekly','monthly','quarterly','yearly')) DEFAULT 'monthly',
    next_date DATE NOT NULL,
    last_generated_at TIMESTAMPTZ,
    items JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.recurring_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recurring_templates access" ON public.recurring_templates;
CREATE POLICY "recurring_templates access" ON public.recurring_templates
  FOR ALL USING (
    company_id IN (SELECT public.user_company_ids())
  );

-- Clés API (Business+)
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "api_keys access" ON public.api_keys;
CREATE POLICY "api_keys access" ON public.api_keys
  FOR ALL USING (
    company_id IN (SELECT public.user_admin_company_ids())
  );

-- Webhooks
CREATE TABLE IF NOT EXISTS public.webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    events TEXT[] DEFAULT ARRAY['invoice.created','invoice.paid'],
    secret TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "webhooks access" ON public.webhooks;
CREATE POLICY "webhooks access" ON public.webhooks
  FOR ALL USING (
    company_id IN (SELECT public.user_admin_company_ids())
  );

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload JSONB,
    status_code INTEGER,
    response_body TEXT,
    delivered_at TIMESTAMPTZ DEFAULT now()
);

-- ====================================================================
-- PHASE 4 — Enterprise
-- ====================================================================

-- Audit log (company_id SET NULL pour permettre suppression company)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    before_data JSONB,
    after_data JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs access" ON public.audit_logs;
CREATE POLICY "audit_logs access" ON public.audit_logs
  FOR SELECT USING (
    company_id IN (SELECT public.user_admin_company_ids())
  );

CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON public.audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- Trigger générique pour audit (sur invoices, clients, products, payments)
-- SECURITY DEFINER : bypass RLS pour pouvoir insérer dans audit_logs
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comp_id UUID;
  inv_id  UUID;
BEGIN
  -- payments n'a pas de company_id direct → résoudre via invoice
  IF TG_TABLE_NAME = 'payments' THEN
    inv_id := COALESCE(
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.invoice_id END,
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.invoice_id END
    );
    SELECT i.company_id INTO comp_id FROM public.invoices i WHERE i.id = inv_id;
  ELSE
    IF TG_OP = 'DELETE' THEN
      comp_id := OLD.company_id;
    ELSE
      comp_id := NEW.company_id;
    END IF;
  END IF;

  -- Skip si la company parent est en cours de suppression (cascade) ou inconnue
  IF comp_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.companies WHERE id = comp_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.audit_logs (company_id, user_id, action, entity_type, entity_id, before_data, after_data)
  VALUES (
    comp_id,
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS audit_invoices ON public.invoices;
CREATE TRIGGER audit_invoices AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_clients ON public.clients;
CREATE TRIGGER audit_clients AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- Pas de trigger audit sur payments :
-- payment.received déjà tracé via webhook_queue trigger.
DROP TRIGGER IF EXISTS audit_payments ON public.payments;

-- ====================================================================
-- ACOMPTES / paiements partiels
-- ====================================================================
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft','sent','partial','paid','overdue','canceled','accepted','rejected'));

-- Vue pratique : facture + montant déjà payé + solde restant
CREATE OR REPLACE VIEW public.invoices_with_balance AS
SELECT
  i.*,
  COALESCE(SUM(p.amount), 0) AS amount_paid,
  GREATEST(i.total_ttc - COALESCE(SUM(p.amount), 0), 0) AS amount_due
FROM public.invoices i
LEFT JOIN public.payments p ON p.invoice_id = i.id
GROUP BY i.id;

-- Trigger : recalcule le statut quand un paiement est inséré/supprimé
CREATE OR REPLACE FUNCTION public.recompute_invoice_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv_id UUID;
  total NUMERIC;
  paid NUMERIC;
  cur_status TEXT;
BEGIN
  inv_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT total_ttc, status INTO total, cur_status FROM public.invoices WHERE id = inv_id;
  IF cur_status IN ('draft','canceled') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO paid FROM public.payments WHERE invoice_id = inv_id;
  IF paid >= total THEN
    UPDATE public.invoices SET status = 'paid', updated_at = now() WHERE id = inv_id;
  ELSIF paid > 0 THEN
    UPDATE public.invoices SET status = 'partial', updated_at = now() WHERE id = inv_id;
  ELSE
    UPDATE public.invoices SET status = 'sent', updated_at = now() WHERE id = inv_id AND status IN ('paid','partial');
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS recompute_status_on_payment ON public.payments;
CREATE TRIGGER recompute_status_on_payment
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.recompute_invoice_status();

-- ====================================================================
-- NUMÉROTATION SÉQUENTIELLE (DGI conforme — pas de trous)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.document_sequences (
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL,
    year INTEGER NOT NULL,
    last_seq INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (company_id, doc_type, year)
);

ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "document_sequences access" ON public.document_sequences;
CREATE POLICY "document_sequences access" ON public.document_sequences
  FOR ALL USING (
    company_id IN (SELECT public.user_company_ids())
  );

-- Fonction atomique : retourne le prochain numéro et incrémente
CREATE OR REPLACE FUNCTION public.next_document_number(
  p_company_id UUID,
  p_doc_type TEXT,
  p_prefix TEXT
)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  cur_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  new_seq INTEGER;
BEGIN
  INSERT INTO public.document_sequences (company_id, doc_type, year, last_seq)
  VALUES (p_company_id, p_doc_type, cur_year, 1)
  ON CONFLICT (company_id, doc_type, year)
  DO UPDATE SET last_seq = public.document_sequences.last_seq + 1
  RETURNING last_seq INTO new_seq;

  RETURN p_prefix || '-' || cur_year || '-' || LPAD(new_seq::TEXT, 4, '0');
END $$;

-- ====================================================================
-- WEBHOOK EXECUTOR — trigger qui enqueue les events
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.webhook_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload JSONB NOT NULL,
    attempts INTEGER DEFAULT 0,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_queue_pending ON public.webhook_queue(created_at) WHERE delivered_at IS NULL;

CREATE OR REPLACE FUNCTION public.enqueue_webhook_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  evt TEXT;
  payload JSONB;
  comp_id UUID;
  inv_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'invoices' THEN
    comp_id := COALESCE(NEW.company_id, OLD.company_id);
    IF TG_OP = 'INSERT' THEN
      evt := CASE NEW.type
        WHEN 'estimate' THEN 'estimate.created'
        ELSE 'invoice.created'
      END;
      payload := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' AND OLD.status <> NEW.status THEN
      evt := CASE NEW.status
        WHEN 'paid' THEN 'invoice.paid'
        WHEN 'sent' THEN 'invoice.sent'
        WHEN 'overdue' THEN 'invoice.overdue'
        WHEN 'accepted' THEN 'estimate.accepted'
        ELSE NULL
      END;
      IF evt IS NULL THEN RETURN NEW; END IF;
      payload := to_jsonb(NEW);
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'payments' AND TG_OP = 'INSERT' THEN
    inv_id := NEW.invoice_id;
    SELECT i.company_id INTO comp_id FROM public.invoices i WHERE i.id = inv_id;
    evt := 'payment.received';
    payload := to_jsonb(NEW);
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF comp_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  INSERT INTO public.webhook_queue (webhook_id, event, payload)
  SELECT w.id, evt, payload
  FROM public.webhooks w
  WHERE w.company_id = comp_id AND w.active = true AND evt = ANY(w.events);

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS webhook_invoices ON public.invoices;
CREATE TRIGGER webhook_invoices AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_webhook_event();

DROP TRIGGER IF EXISTS webhook_payments ON public.payments;
CREATE TRIGGER webhook_payments AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_webhook_event();

-- ====================================================================
-- INDEXES additionnels
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_invoices_type ON public.invoices(type);
CREATE INDEX IF NOT EXISTS idx_invoices_currency ON public.invoices(currency);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date) WHERE status = 'sent';
CREATE INDEX IF NOT EXISTS idx_recurring_next_date ON public.recurring_templates(next_date) WHERE active = true;
