-- ====================================================================
-- COMPTES DE DÉMO FACTURA — 3 entreprises avec données réalistes
-- À exécuter dans Supabase SQL Editor (run as service_role)
-- Idempotent : re-run = supprime puis recrée tout proprement.
--
-- Identifiants :
--   starter@demo-factura.ci  / Demo@2024  → BIJOU STYLE CI (Gratuit)
--   pro@demo-factura.ci      / Demo@2024  → DIGITAL AGENCY CI (Pro)
--   business@demo-factura.ci / Demo@2024  → BATI CONSTRUCT GROUP SARL (Business)
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 0) Patch préalable de la fonction audit_trigger
-- 1) skip si company parent supprimée (cascade)
-- 2) gère les payments (pas de company_id direct → résolu via invoice)
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  comp_id UUID;
  inv_id  UUID;
BEGIN
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

  IF comp_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.companies WHERE id = comp_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.audit_logs (company_id, user_id, action, entity_type, entity_id, before_data, after_data)
  VALUES (
    comp_id, auth.uid(), TG_OP, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END $$;

ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_company_id_fkey;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;

-- Retire le trigger audit sur payments : payments n'a pas de company_id direct
-- et l'événement payment.received est déjà tracé via webhook_queue.
DROP TRIGGER IF EXISTS audit_payments ON public.payments;

-- 1) Nettoyage si re-run
-- Désactive triggers audit en plus pour belt-and-suspenders
ALTER TABLE public.invoices DISABLE TRIGGER audit_invoices;
ALTER TABLE public.clients  DISABLE TRIGGER audit_clients;

DO $$
DECLARE
  uid UUID;
BEGIN
  FOR uid IN
    SELECT id FROM auth.users
    WHERE email IN ('starter@demo-factura.ci','pro@demo-factura.ci','business@demo-factura.ci')
  LOOP
    DELETE FROM auth.identities WHERE user_id = uid;
    DELETE FROM auth.users WHERE id = uid;
  END LOOP;
END $$;

-- Réactive triggers
ALTER TABLE public.invoices ENABLE TRIGGER audit_invoices;
ALTER TABLE public.clients  ENABLE TRIGGER audit_clients;

-- 2) Création des 3 utilisateurs avec mot de passe bcrypt
DO $$
DECLARE
  u_starter  UUID := gen_random_uuid();
  u_pro      UUID := gen_random_uuid();
  u_business UUID := gen_random_uuid();
  c_starter  UUID;
  c_pro      UUID;
  c_business UUID;
  inv_id     UUID;
  cli_arr    UUID[];
  cur_year   INT := EXTRACT(YEAR FROM CURRENT_DATE);
  i INT;
  amt NUMERIC;
BEGIN

  -- ── USERS ──
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
                          aud, role)
  VALUES
    (u_starter,  '00000000-0000-0000-0000-000000000000', 'starter@demo-factura.ci',
     crypt('Demo@2024', gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     'authenticated', 'authenticated'),
    (u_pro,      '00000000-0000-0000-0000-000000000000', 'pro@demo-factura.ci',
     crypt('Demo@2024', gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     'authenticated', 'authenticated'),
    (u_business, '00000000-0000-0000-0000-000000000000', 'business@demo-factura.ci',
     crypt('Demo@2024', gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     'authenticated', 'authenticated');

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id,
                               last_sign_in_at, created_at, updated_at)
  VALUES
    (gen_random_uuid(), u_starter,  jsonb_build_object('sub', u_starter::text,  'email', 'starter@demo-factura.ci'),  'email', 'starter@demo-factura.ci',  now(), now(), now()),
    (gen_random_uuid(), u_pro,      jsonb_build_object('sub', u_pro::text,      'email', 'pro@demo-factura.ci'),      'email', 'pro@demo-factura.ci',      now(), now(), now()),
    (gen_random_uuid(), u_business, jsonb_build_object('sub', u_business::text, 'email', 'business@demo-factura.ci'), 'email', 'business@demo-factura.ci', now(), now(), now());

  -- ====================================================================
  -- A) BIJOU STYLE CI — starter
  -- ====================================================================
  INSERT INTO public.companies (user_id, name, ncc, address, phone, email)
  VALUES (u_starter, 'BIJOU STYLE CI', '0011223 X', 'Marcory Zone 4, Abidjan', '+225 07 11 22 33 44', 'contact@bijou-style.ci')
  RETURNING id INTO c_starter;

  -- subscription auto-créée starter par le trigger → on garde

  -- 3 clients
  INSERT INTO public.clients (company_id, client_number, name, type, email, phone, address) VALUES
    (c_starter, 'CLI-0001', 'Boutique Aïcha',  'particulier', 'aicha@example.ci',  '+225 05 00 11 22 33', 'Cocody, Abidjan'),
    (c_starter, 'CLI-0002', 'Madame Affoué',   'particulier', 'affoue@example.ci', '+225 07 00 22 33 44', 'Yopougon, Abidjan'),
    (c_starter, 'CLI-0003', 'Mariam Touré',    'particulier', 'mariam@example.ci', '+225 01 00 33 44 55', 'Plateau, Abidjan');

  -- 3 produits
  INSERT INTO public.products (company_id, name, description, unit_price, unit, tva_rate) VALUES
    (c_starter, 'Bracelet argent',   'Argent 925 sterling', 25000, 'pièce', 18),
    (c_starter, 'Collier perles',    'Perles eau douce',    35000, 'pièce', 18),
    (c_starter, 'Bague or 18k',      'Or jaune 18 carats',  80000, 'pièce', 18);

  -- 5 factures (encaissé total = 205 000 FCFA : 80 + 65 + 60 = 205k)
  -- Facture 1 — payée 80 000
  INSERT INTO public.invoices (company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, currency)
  VALUES (c_starter, (SELECT id FROM public.clients WHERE company_id=c_starter AND client_number='CLI-0001'),
          'invoice', public.next_document_number(c_starter, 'invoice', 'FAC'),
          'paid', CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE - INTERVAL '5 days',
          67797, 12203, 80000, 'XOF')
  RETURNING id INTO inv_id;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
    (inv_id, 'Bague or 18k', 1, 67797, 18, 'pièce');
  INSERT INTO public.payments (invoice_id, amount, method, reference, payment_date) VALUES
    (inv_id, 80000, 'wave', 'WV-2024-001', CURRENT_DATE - INTERVAL '4 days');

  -- Facture 2 — payée 65 000
  INSERT INTO public.invoices (company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, currency)
  VALUES (c_starter, (SELECT id FROM public.clients WHERE company_id=c_starter AND client_number='CLI-0002'),
          'invoice', public.next_document_number(c_starter, 'invoice', 'FAC'),
          'paid', CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE,
          55085, 9915, 65000, 'XOF')
  RETURNING id INTO inv_id;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
    (inv_id, 'Collier perles + Bracelet argent', 1, 55085, 18, 'lot');
  INSERT INTO public.payments (invoice_id, amount, method, payment_date) VALUES
    (inv_id, 65000, 'om', CURRENT_DATE - INTERVAL '10 days');

  -- Facture 3 — payée 60 000
  INSERT INTO public.invoices (company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, currency)
  VALUES (c_starter, (SELECT id FROM public.clients WHERE company_id=c_starter AND client_number='CLI-0003'),
          'invoice', public.next_document_number(c_starter, 'invoice', 'FAC'),
          'paid', CURRENT_DATE - INTERVAL '8 days', CURRENT_DATE + INTERVAL '7 days',
          50847, 9153, 60000, 'XOF')
  RETURNING id INTO inv_id;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
    (inv_id, 'Bracelet argent x2', 2, 25424, 18, 'pièce');
  INSERT INTO public.payments (invoice_id, amount, method, payment_date) VALUES
    (inv_id, 60000, 'cash', CURRENT_DATE - INTERVAL '2 days');

  -- Facture 4 — envoyée 45 000 (non payée)
  INSERT INTO public.invoices (company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, currency)
  VALUES (c_starter, (SELECT id FROM public.clients WHERE company_id=c_starter AND client_number='CLI-0001'),
          'invoice', public.next_document_number(c_starter, 'invoice', 'FAC'),
          'sent', CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '12 days',
          38136, 6864, 45000, 'XOF');

  -- Facture 5 — brouillon 30 000
  INSERT INTO public.invoices (company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, currency)
  VALUES (c_starter, (SELECT id FROM public.clients WHERE company_id=c_starter AND client_number='CLI-0002'),
          'invoice', public.next_document_number(c_starter, 'invoice', 'FAC'),
          'draft', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
          25424, 4576, 30000, 'XOF');

  -- ====================================================================
  -- B) DIGITAL AGENCY CI — pro
  -- ====================================================================
  INSERT INTO public.companies (user_id, name, ncc, address, phone, email)
  VALUES (u_pro, 'DIGITAL AGENCY CI', '0044556 Y', 'II Plateaux, Cocody, Abidjan', '+225 27 22 44 55 66', 'hello@digital-agency.ci')
  RETURNING id INTO c_pro;

  UPDATE public.subscriptions SET plan = 'pro' WHERE company_id = c_pro;

  -- 10 clients
  INSERT INTO public.clients (company_id, client_number, name, type, email, phone, address, tax_id) VALUES
    (c_pro, 'CLI-0001', 'Orange CI',                'entreprise', 'finance@orange-test.ci',     '+225 27 20 25 25 25', 'Plateau, Abidjan',  '0012345 A'),
    (c_pro, 'CLI-0002', 'MTN CI',                   'entreprise', 'compta@mtn-test.ci',         '+225 05 04 03 02 01', 'Cocody, Abidjan',   '0067890 B'),
    (c_pro, 'CLI-0003', 'Société Générale CI',      'entreprise', 'achats@sgci-test.ci',        '+225 27 20 20 12 34', 'Plateau, Abidjan',  '0023456 C'),
    (c_pro, 'CLI-0004', 'NSIA Banque',              'entreprise', 'compta@nsia-test.ci',        '+225 27 20 31 20 00', 'Plateau, Abidjan',  '0034567 D'),
    (c_pro, 'CLI-0005', 'Coris Bank International', 'entreprise', 'fournisseurs@coris-test.ci', '+225 27 22 49 00 00', 'Marcory, Abidjan',  '0045678 E'),
    (c_pro, 'CLI-0006', 'Petit Café Abidjan',       'entreprise', 'gerant@petitcafe.ci',        '+225 07 88 77 66 55', 'Marcory, Abidjan',  '0056789 F'),
    (c_pro, 'CLI-0007', 'Restaurant Le Wafou',      'entreprise', 'compta@wafou.ci',            '+225 05 12 34 56 78', 'Cocody, Abidjan',   '0067891 G'),
    (c_pro, 'CLI-0008', 'KA Digital',               'entreprise', 'kouame@kadigital.ci',        '+225 01 22 33 44 55', 'Riviera, Abidjan',  '0078912 H'),
    (c_pro, 'CLI-0009', 'JBK Imports',              'entreprise', 'jbk@imports.ci',             '+225 27 21 11 22 33', 'Treichville, Abidjan','0089123 I'),
    (c_pro, 'CLI-0010', 'Mlle Aminata Diallo',      'particulier','aminata.diallo@gmail.com',   '+225 07 99 88 77 66', 'Yopougon, Abidjan', NULL);

  -- 7 produits
  INSERT INTO public.products (company_id, name, description, unit_price, unit, tva_rate) VALUES
    (c_pro, 'Site vitrine',              'Site web 5 pages responsive',          750000, 'forfait', 18),
    (c_pro, 'Site e-commerce',           'Boutique en ligne complète',          1500000, 'forfait', 18),
    (c_pro, 'Application mobile',        'App Android + iOS sur mesure',        2500000, 'forfait', 18),
    (c_pro, 'Maintenance mensuelle',     'Mises à jour + monitoring',           150000, 'mois',    18),
    (c_pro, 'Community management',      'Gestion réseaux sociaux',              200000, 'mois',    18),
    (c_pro, 'SEO Premium',               'Référencement Google',                 350000, 'mois',    18),
    (c_pro, 'Consulting digital',        'Conseil stratégique',                   80000, 'heure',   18);

  -- 25 factures, encaissé total = 7 225 000 FCFA
  -- 18 payées intégralement, 4 partielles, 3 envoyées/brouillon
  cli_arr := ARRAY(SELECT id FROM public.clients WHERE company_id = c_pro ORDER BY client_number);

  -- 18 factures payées (sum = 6 700 000)
  FOR i IN 1..18 LOOP
    amt := (ARRAY[150000, 200000, 350000, 650000, 200000, 150000, 500000, 350000,
                  200000, 150000, 750000, 500000, 200000, 150000, 350000, 500000,
                  500000, 850000])[i]::NUMERIC;
    INSERT INTO public.invoices (company_id, client_id, type, number, status, issue_date, due_date,
                                 subtotal_ht, total_tva, total_ttc, currency)
    VALUES (c_pro, cli_arr[(i % 10) + 1], 'invoice',
            public.next_document_number(c_pro, 'invoice', 'FAC'),
            'paid',
            CURRENT_DATE - (60 - i*2 || ' days')::INTERVAL,
            CURRENT_DATE - (45 - i*2 || ' days')::INTERVAL,
            ROUND(amt / 1.18, 0), ROUND(amt - amt / 1.18, 0), amt, 'XOF')
    RETURNING id INTO inv_id;
    INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
      (inv_id, 'Prestation digitale', 1, ROUND(amt / 1.18, 0), 18, 'forfait');
    INSERT INTO public.payments (invoice_id, amount, method, payment_date) VALUES
      (inv_id, amt, (ARRAY['wave','om','mtn','transfer'])[(i % 4) + 1], CURRENT_DATE - ((40 - i*2) || ' days')::INTERVAL);
  END LOOP;

  -- 4 factures partielles (encaissé partial = 525 000)
  -- Facture 19 — total 800k, payée 200k
  INSERT INTO public.invoices (company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, currency)
  VALUES (c_pro, cli_arr[1], 'invoice', public.next_document_number(c_pro, 'invoice', 'FAC'),
          'partial', CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE + INTERVAL '10 days',
          677966, 122034, 800000, 'XOF') RETURNING id INTO inv_id;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
    (inv_id, 'Site vitrine + maintenance 2 mois', 1, 677966, 18, 'forfait');
  INSERT INTO public.payments (invoice_id, amount, method, payment_date) VALUES
    (inv_id, 200000, 'wave', CURRENT_DATE - INTERVAL '15 days');

  -- Facture 20 — total 600k, payée 150k
  INSERT INTO public.invoices (company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, currency)
  VALUES (c_pro, cli_arr[2], 'invoice', public.next_document_number(c_pro, 'invoice', 'FAC'),
          'partial', CURRENT_DATE - INTERVAL '18 days', CURRENT_DATE + INTERVAL '12 days',
          508475, 91525, 600000, 'XOF') RETURNING id INTO inv_id;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
    (inv_id, 'SEO Premium x2 mois', 2, 254237, 18, 'mois');
  INSERT INTO public.payments (invoice_id, amount, method, payment_date) VALUES
    (inv_id, 150000, 'om', CURRENT_DATE - INTERVAL '12 days');

  -- Facture 21 — total 500k, payée 100k
  INSERT INTO public.invoices (company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, currency)
  VALUES (c_pro, cli_arr[3], 'invoice', public.next_document_number(c_pro, 'invoice', 'FAC'),
          'partial', CURRENT_DATE - INTERVAL '12 days', CURRENT_DATE + INTERVAL '18 days',
          423729, 76271, 500000, 'XOF') RETURNING id INTO inv_id;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
    (inv_id, 'Community management', 1, 423729, 18, 'mois');
  INSERT INTO public.payments (invoice_id, amount, method, payment_date) VALUES
    (inv_id, 100000, 'mtn', CURRENT_DATE - INTERVAL '8 days');

  -- Facture 22 — total 300k, payée 75k (acompte 25%)
  INSERT INTO public.invoices (company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, currency)
  VALUES (c_pro, cli_arr[4], 'invoice', public.next_document_number(c_pro, 'invoice', 'FAC'),
          'partial', CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE + INTERVAL '23 days',
          254237, 45763, 300000, 'XOF') RETURNING id INTO inv_id;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
    (inv_id, 'Maintenance mensuelle x2', 2, 127119, 18, 'mois');
  INSERT INTO public.payments (invoice_id, amount, method, payment_date) VALUES
    (inv_id, 75000, 'wave', CURRENT_DATE - INTERVAL '5 days');

  -- 3 factures non payées (envoyée + retard + brouillon)
  INSERT INTO public.invoices (company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, currency) VALUES
    (c_pro, cli_arr[5], 'invoice', public.next_document_number(c_pro, 'invoice', 'FAC'),
     'sent',    CURRENT_DATE - INTERVAL '4 days',  CURRENT_DATE + INTERVAL '11 days', 211864, 38136, 250000, 'XOF'),
    (c_pro, cli_arr[6], 'invoice', public.next_document_number(c_pro, 'invoice', 'FAC'),
     'overdue', CURRENT_DATE - INTERVAL '50 days', CURRENT_DATE - INTERVAL '20 days', 169492, 30508, 200000, 'XOF'),
    (c_pro, cli_arr[7], 'invoice', public.next_document_number(c_pro, 'invoice', 'FAC'),
     'draft',   CURRENT_DATE,                      CURRENT_DATE + INTERVAL '30 days', 423729, 76271, 500000, 'XOF');

  -- ====================================================================
  -- C) BATI CONSTRUCT GROUP SARL — business
  -- ====================================================================
  INSERT INTO public.companies (user_id, name, ncc, address, phone, email)
  VALUES (u_business, 'BATI CONSTRUCT GROUP SARL', '0099887 Z', 'Zone industrielle Yopougon, Abidjan', '+225 27 23 45 67 89', 'devis@baticonstruct.ci')
  RETURNING id INTO c_business;

  UPDATE public.subscriptions SET plan = 'business' WHERE company_id = c_business;

  -- 7 clients
  INSERT INTO public.clients (company_id, client_number, name, type, email, phone, address, tax_id) VALUES
    (c_business, 'CLI-0001', 'Ministère de l''Équipement',  'entreprise', 'marches@minequip.gouv.ci',  '+225 27 20 30 40 50', 'Plateau, Abidjan',     '0001000 G'),
    (c_business, 'CLI-0002', 'SODECI',                       'entreprise', 'achats@sodeci.ci',          '+225 27 21 23 34 45', 'Treichville, Abidjan', '0001100 G'),
    (c_business, 'CLI-0003', 'Port Autonome d''Abidjan',     'entreprise', 'fournisseurs@paa.ci',       '+225 27 21 23 80 00', 'Vridi, Abidjan',       '0001200 G'),
    (c_business, 'CLI-0004', 'Sucrivoire',                   'entreprise', 'compta@sucrivoire.ci',      '+225 27 23 45 12 12', 'Ferké',                '0001300 H'),
    (c_business, 'CLI-0005', 'Promoteur Immobilier ESPACE',  'entreprise', 'projets@espace.ci',         '+225 05 11 22 33 44', 'Cocody, Abidjan',      '0001400 H'),
    (c_business, 'CLI-0006', 'Coopérative AGRI-CI',          'entreprise', 'tresorerie@agrici.coop',    '+225 27 31 22 33 44', 'Bouaké',               '0001500 I'),
    (c_business, 'CLI-0007', 'M. Konan Yao (privé)',         'particulier','konan.yao@gmail.com',       '+225 07 55 44 33 22', 'Riviera, Abidjan',     NULL);

  -- 5 produits
  INSERT INTO public.products (company_id, name, description, unit_price, unit, tva_rate) VALUES
    (c_business, 'Construction villa R+1',     'Villa 4 pièces clé en main',     45000000, 'forfait', 18),
    (c_business, 'Réfection toiture',          'Réfection complète m²',                30000, 'm²',      18),
    (c_business, 'Carrelage premium',          'Pose carrelage import Italie m²',      25000, 'm²',      18),
    (c_business, 'Peinture intérieure',        'Peinture acrylique m²',                 5000, 'm²',      18),
    (c_business, 'Étude technique',            'Plans + métrés + permis',          1200000, 'forfait', 18);

  -- 15 factures, encaissé total = 61 000 000 FCFA
  -- Stratégie : 9 payées intégralement (sum = 53 000 000) + 4 partielles (sum payée = 8 000 000) + 2 sent/draft
  cli_arr := ARRAY(SELECT id FROM public.clients WHERE company_id = c_business ORDER BY client_number);

  -- 9 factures payées intégralement = 53 000 000
  FOR i IN 1..9 LOOP
    amt := (ARRAY[15000000, 8000000, 5000000, 4500000, 6000000, 3500000, 4000000, 3500000, 3500000])[i]::NUMERIC;
    INSERT INTO public.invoices (company_id, client_id, type, number, status, issue_date, due_date,
                                 subtotal_ht, total_tva, total_ttc, currency, notes)
    VALUES (c_business, cli_arr[((i-1) % 7) + 1], 'invoice',
            public.next_document_number(c_business, 'invoice', 'FAC'),
            'paid',
            CURRENT_DATE - (90 - i*5 || ' days')::INTERVAL,
            CURRENT_DATE - (60 - i*5 || ' days')::INTERVAL,
            ROUND(amt / 1.18, 0), ROUND(amt - amt / 1.18, 0), amt, 'XOF',
            'Marché ' || (cur_year - 1) || '-' || LPAD(i::text, 3, '0'))
    RETURNING id INTO inv_id;
    INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
      (inv_id, 'Travaux BTP — lot ' || i, 1, ROUND(amt / 1.18, 0), 18, 'forfait');
    INSERT INTO public.payments (invoice_id, amount, method, payment_date) VALUES
      (inv_id, amt, (ARRAY['transfer','wave','transfer','transfer'])[(i % 4) + 1], CURRENT_DATE - ((50 - i*5) || ' days')::INTERVAL);
  END LOOP;

  -- 4 factures partielles — encaissement total = 8 000 000 (acomptes)
  -- F10 — total 12M, acompte 3M
  INSERT INTO public.invoices (company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, currency, notes)
  VALUES (c_business, cli_arr[1], 'invoice', public.next_document_number(c_business, 'invoice', 'FAC'),
          'partial', CURRENT_DATE - INTERVAL '40 days', CURRENT_DATE + INTERVAL '20 days',
          10169492, 1830508, 12000000, 'XOF', 'Construction villa Cocody — acompte 25%')
  RETURNING id INTO inv_id;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
    (inv_id, 'Construction villa R+1 (acompte)', 1, 10169492, 18, 'forfait');
  INSERT INTO public.payments (invoice_id, amount, method, reference, payment_date) VALUES
    (inv_id, 3000000, 'transfer', 'VIR-2024-101', CURRENT_DATE - INTERVAL '38 days');

  -- F11 — total 6M, acompte 2M
  INSERT INTO public.invoices (company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, currency, notes)
  VALUES (c_business, cli_arr[2], 'invoice', public.next_document_number(c_business, 'invoice', 'FAC'),
          'partial', CURRENT_DATE - INTERVAL '25 days', CURRENT_DATE + INTERVAL '5 days',
          5084746, 915254, 6000000, 'XOF', 'Réfection toiture — versement intermédiaire')
  RETURNING id INTO inv_id;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
    (inv_id, 'Réfection toiture 200 m²', 200, 25424, 18, 'm²');
  INSERT INTO public.payments (invoice_id, amount, method, reference, payment_date) VALUES
    (inv_id, 2000000, 'transfer', 'VIR-2024-115', CURRENT_DATE - INTERVAL '20 days');

  -- F12 — total 4M, acompte 2M (50%)
  INSERT INTO public.invoices (company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, currency, notes)
  VALUES (c_business, cli_arr[3], 'invoice', public.next_document_number(c_business, 'invoice', 'FAC'),
          'partial', CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '15 days',
          3389831, 610169, 4000000, 'XOF', 'Carrelage entrepôt — 50% à la commande')
  RETURNING id INTO inv_id;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
    (inv_id, 'Carrelage premium pose comprise 160 m²', 160, 21186, 18, 'm²');
  INSERT INTO public.payments (invoice_id, amount, method, reference, payment_date) VALUES
    (inv_id, 2000000, 'wave', 'WV-2024-088', CURRENT_DATE - INTERVAL '14 days');

  -- F13 — total 3M, acompte 1M
  INSERT INTO public.invoices (company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, currency, notes)
  VALUES (c_business, cli_arr[5], 'invoice', public.next_document_number(c_business, 'invoice', 'FAC'),
          'partial', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '20 days',
          2542373, 457627, 3000000, 'XOF', 'Étude technique + démarrage')
  RETURNING id INTO inv_id;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
    (inv_id, 'Étude technique préliminaire', 1, 1016949, 18, 'forfait'),
    (inv_id, 'Acompte démarrage chantier', 1, 1525424, 18, 'forfait');
  INSERT INTO public.payments (invoice_id, amount, method, reference, payment_date) VALUES
    (inv_id, 1000000, 'transfer', 'VIR-2024-128', CURRENT_DATE - INTERVAL '8 days');

  -- 2 factures non payées (envoyée + retard)
  INSERT INTO public.invoices (company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, currency, notes) VALUES
    (c_business, cli_arr[6], 'invoice', public.next_document_number(c_business, 'invoice', 'FAC'),
     'sent',    CURRENT_DATE - INTERVAL '5 days',  CURRENT_DATE + INTERVAL '25 days',
     1694915, 305085, 2000000, 'XOF', 'Aménagement bureaux — facture en attente'),
    (c_business, cli_arr[7], 'invoice', public.next_document_number(c_business, 'invoice', 'FAC'),
     'overdue', CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE - INTERVAL '30 days',
     762712, 137288, 900000, 'XOF', 'Peinture villa privée — relance recommandée');

  -- ── Bonus Business : 1 devis + 1 BC + 1 BL ──
  INSERT INTO public.invoices (company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, currency, notes) VALUES
    (c_business, cli_arr[1], 'estimate',       public.next_document_number(c_business, 'estimate',       'DEV'),
     'sent', CURRENT_DATE - INTERVAL '8 days', CURRENT_DATE + INTERVAL '22 days',
     38135593, 6864407, 45000000, 'XOF', 'Devis construction villa R+1 — en attente validation'),
    (c_business, cli_arr[2], 'purchase_order', public.next_document_number(c_business, 'purchase_order', 'BC'),
     'sent', CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '27 days',
     2542373, 457627, 3000000, 'XOF', 'Bon de commande matériel chantier'),
    (c_business, cli_arr[2], 'delivery_note',  public.next_document_number(c_business, 'delivery_note',  'BL'),
     'sent', CURRENT_DATE,                     NULL,
     0, 0, 0, 'XOF', 'Bon de livraison — réception matériaux');

  RAISE NOTICE 'Comptes démo créés. Login : starter/pro/business@demo-factura.ci · Demo@2024';
END $$;
