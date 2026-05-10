-- PLAN TARIFAIRE FACTURA — à exécuter dans Supabase SQL Editor

-- 1. Étendre le CHECK de plans
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('starter', 'pro', 'business', 'enterprise'));

-- 2. Trigger anti-self-enterprise (seul service_role peut setter enterprise)
CREATE OR REPLACE FUNCTION public.prevent_self_enterprise()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.plan = 'enterprise' AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Le plan Enterprise nécessite un contrat commercial. Contactez l''équipe commerciale.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS block_enterprise_self_assign ON public.subscriptions;
CREATE TRIGGER block_enterprise_self_assign
  BEFORE INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_enterprise();

-- 3. Table leads Enterprise
CREATE TABLE IF NOT EXISTS public.enterprise_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company_name TEXT NOT NULL,
  company_size TEXT,
  message TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','won','lost')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.enterprise_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit lead" ON public.enterprise_leads;
CREATE POLICY "Anyone can submit lead" ON public.enterprise_leads
  FOR INSERT TO authenticated, anon WITH CHECK (true);

-- 4. Auto-création subscription starter à création company
CREATE OR REPLACE FUNCTION public.auto_create_starter_subscription()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.subscriptions (company_id, plan, status)
  VALUES (NEW.id, 'starter', 'active')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS auto_starter_sub ON public.companies;
CREATE TRIGGER auto_starter_sub
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_starter_subscription();

-- 5. Backfill: companies existantes sans subscription
INSERT INTO public.subscriptions (company_id, plan, status)
SELECT c.id, 'starter', 'active'
FROM public.companies c
LEFT JOIN public.subscriptions s ON s.company_id = c.id
WHERE s.id IS NULL;
