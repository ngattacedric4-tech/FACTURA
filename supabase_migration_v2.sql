-- MIGRATION v2 — alignement schéma avec types TS
-- À exécuter dans Supabase SQL Editor

-- 1. clients : ajouter tax_id + corriger CHECK type
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tax_id TEXT;

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_type_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_type_check
  CHECK (type IN ('particulier', 'entreprise'));

-- Migration valeurs existantes
UPDATE public.clients SET type = 'particulier' WHERE type = 'particular';
UPDATE public.clients SET type = 'entreprise' WHERE type = 'company';

-- 2. invoice_items : ajouter unit
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'unité';

-- 3. payments : ajouter 'mtn' au CHECK
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_method_check
  CHECK (method IN ('wave', 'om', 'mtn', 'cash', 'transfer', 'check'));

-- 4. Storage bucket pour logos
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
