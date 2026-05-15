-- ====================================================================
-- ALIGNEMENT BASE FACTURA — corrige divergences entre code et schéma
-- Idempotent. À exécuter dans Supabase SQL Editor.
-- ====================================================================

-- 1) recurring_templates : ajouter 'weekly' au CHECK
ALTER TABLE public.recurring_templates DROP CONSTRAINT IF EXISTS recurring_templates_frequency_check;
ALTER TABLE public.recurring_templates ADD CONSTRAINT recurring_templates_frequency_check
  CHECK (frequency IN ('weekly','monthly','quarterly','yearly'));

-- 2) automation_settings : colonnes WhatsApp manquantes
ALTER TABLE public.automation_settings ADD COLUMN IF NOT EXISTS whatsapp_reminders_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.automation_settings ADD COLUMN IF NOT EXISTS whatsapp_reminder_template TEXT;

-- 3) audit_logs : FK SET NULL (au cas où pas déjà fait)
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_company_id_fkey;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;

-- 4) Migration advance_* → payments (sans dupliquer)
-- Créer un payment pour chaque invoice ayant advance_amount > 0 sans payment correspondant.
INSERT INTO public.payments (invoice_id, amount, method, reference, payment_date)
SELECT
  i.id,
  i.advance_amount,
  COALESCE(i.advance_method, 'cash'),
  COALESCE(i.advance_reference, 'MIGRATION_ADVANCE'),
  COALESCE(i.advance_date::timestamptz, i.created_at)
FROM public.invoices i
WHERE i.advance_amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.invoice_id = i.id AND p.reference = 'MIGRATION_ADVANCE'
  );

-- Optionnel : remettre advance_amount à 0 après migration (commentaire pour sécurité)
-- UPDATE public.invoices SET advance_amount = 0, advance_method = NULL, advance_reference = NULL, advance_date = NULL
-- WHERE advance_amount > 0;

-- 5) invoice_items : passer amount_ht en GENERATED (recalcul auto sur UPDATE)
-- Risqué si data inconsistante. À faire manuellement après backup.
-- ALTER TABLE public.invoice_items DROP COLUMN amount_ht;
-- ALTER TABLE public.invoice_items ADD COLUMN amount_ht NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED;

-- 6) Vérification post-patch
DO $$
DECLARE
  has_weekly BOOLEAN;
  has_wa_col BOOLEAN;
  fk_action  CHAR(1);
  migrated   INT;
BEGIN
  SELECT pg_get_constraintdef(c.oid) LIKE '%weekly%' INTO has_weekly
  FROM pg_constraint c WHERE c.conname = 'recurring_templates_frequency_check';

  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='automation_settings' AND column_name='whatsapp_reminders_enabled')
    INTO has_wa_col;

  SELECT confdeltype INTO fk_action
  FROM pg_constraint WHERE conname = 'audit_logs_company_id_fkey';

  SELECT COUNT(*) INTO migrated FROM public.payments WHERE reference = 'MIGRATION_ADVANCE';

  RAISE NOTICE '── Vérification ──';
  RAISE NOTICE 'recurring weekly OK : %', has_weekly;
  RAISE NOTICE 'whatsapp cols OK    : %', has_wa_col;
  RAISE NOTICE 'audit FK action     : % (n=SET NULL souhaité)', fk_action;
  RAISE NOTICE 'advances migrated   : % paiements', migrated;
END $$;
