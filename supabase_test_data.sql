-- ====================================================================
-- DONNÉES DE TEST FACTURA
-- Lance ce script connecté en tant que ton utilisateur (Supabase SQL Editor
-- a accès à auth.uid() de ton compte). Idempotent : peut être ré-exécuté.
-- ====================================================================

DO $$
DECLARE
  comp_id UUID;
  c1 UUID; c2 UUID; c3 UUID; c4 UUID; c5 UUID;
  p1 UUID; p2 UUID; p3 UUID; p4 UUID;
  inv1 UUID; inv2 UUID; inv3 UUID; inv4 UUID; inv5 UUID; inv6 UUID;
  est1 UUID; est2 UUID;
  bc1 UUID; bl1 UUID;
BEGIN
  -- Active plan Business pour tester toutes les features
  SELECT id INTO comp_id FROM public.companies WHERE user_id = auth.uid() LIMIT 1;
  IF comp_id IS NULL THEN
    RAISE EXCEPTION 'Aucune company trouvée pour l''utilisateur courant. Créez d''abord votre entreprise via l''onboarding.';
  END IF;

  UPDATE public.subscriptions SET plan = 'business', status = 'active' WHERE company_id = comp_id;

  -- Nettoie données test précédentes (laisse intactes celles créées via UI)
  DELETE FROM public.invoices WHERE company_id = comp_id AND notes LIKE '%[TEST DATA]%';
  DELETE FROM public.clients WHERE company_id = comp_id AND email LIKE '%@test-factura.ci';
  DELETE FROM public.products WHERE company_id = comp_id AND description LIKE '%[TEST]%';

  -- ── CLIENTS ──
  INSERT INTO public.clients (id, company_id, client_number, name, type, email, phone, address, tax_id) VALUES
    (gen_random_uuid(), comp_id, 'CLI-TEST-01', 'Orange Côte d''Ivoire SA',  'entreprise', 'finance@orange-test-factura.ci', '+225 27 20 25 25 25', 'Plateau, Abidjan',         '0012345 A')
    RETURNING id INTO c1;
  INSERT INTO public.clients (id, company_id, client_number, name, type, email, phone, address, tax_id) VALUES
    (gen_random_uuid(), comp_id, 'CLI-TEST-02', 'MTN CI',                    'entreprise', 'compta@mtn-test-factura.ci',    '+225 05 04 03 02 01', 'Cocody Riviera, Abidjan',  '0067890 B')
    RETURNING id INTO c2;
  INSERT INTO public.clients (id, company_id, client_number, name, type, email, phone, address, tax_id) VALUES
    (gen_random_uuid(), comp_id, 'CLI-TEST-03', 'Boutique Kouamé Assi',      'particulier', 'kouame@kouame-test-factura.ci', '+225 07 88 77 66 55', 'Yopougon, Abidjan',        NULL)
    RETURNING id INTO c3;
  INSERT INTO public.clients (id, company_id, client_number, name, type, email, phone, address, tax_id) VALUES
    (gen_random_uuid(), comp_id, 'CLI-TEST-04', 'Pharmacie Aminata',         'entreprise', 'aminata@pharma-test-factura.ci','+225 01 02 03 04 05', 'Marcory, Abidjan',         '0099887 C')
    RETURNING id INTO c4;
  INSERT INTO public.clients (id, company_id, client_number, name, type, email, phone, address, tax_id) VALUES
    (gen_random_uuid(), comp_id, 'CLI-TEST-05', 'Construction JBK',          'entreprise', 'jbk@construction-test-factura.ci','+225 27 22 11 22 33', 'Treichville, Abidjan',     '0011223 D')
    RETURNING id INTO c5;

  -- ── PRODUITS ──
  INSERT INTO public.products (id, company_id, name, description, unit_price, unit, tva_rate) VALUES
    (gen_random_uuid(), comp_id, 'Développement web', '[TEST] Création site vitrine ou e-commerce',          850000, 'forfait', 18)
    RETURNING id INTO p1;
  INSERT INTO public.products (id, company_id, name, description, unit_price, unit, tva_rate) VALUES
    (gen_random_uuid(), comp_id, 'Maintenance mensuelle', '[TEST] Suivi technique + mises à jour',           150000, 'mois',    18)
    RETURNING id INTO p2;
  INSERT INTO public.products (id, company_id, name, description, unit_price, unit, tva_rate) VALUES
    (gen_random_uuid(), comp_id, 'Consulting (heure)', '[TEST] Conseil stratégique IT',                       50000, 'heure',   18)
    RETURNING id INTO p3;
  INSERT INTO public.products (id, company_id, name, description, unit_price, unit, tva_rate) VALUES
    (gen_random_uuid(), comp_id, 'Formation équipe', '[TEST] Session de formation 1 journée',                300000, 'jour',    18)
    RETURNING id INTO p4;

  -- ── FACTURES (numérotation séquentielle via RPC) ──

  -- 1. Facture payée intégralement
  INSERT INTO public.invoices (id, company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, notes, currency)
  VALUES (gen_random_uuid(), comp_id, c1, 'invoice',
          public.next_document_number(comp_id, 'invoice', 'FAC'),
          'paid', CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE - INTERVAL '5 days',
          1000000, 180000, 1180000, '[TEST DATA] Facture payée — démonstration', 'XOF')
  RETURNING id INTO inv1;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
    (inv1, 'Développement application mobile', 1, 850000, 18, 'forfait'),
    (inv1, 'Maintenance mensuelle', 1, 150000, 18, 'mois');
  INSERT INTO public.payments (invoice_id, amount, method, reference, payment_date) VALUES
    (inv1, 1180000, 'wave', 'WAVE-REF-001', CURRENT_DATE - INTERVAL '3 days');

  -- 2. Facture avec ACOMPTE 30%
  INSERT INTO public.invoices (id, company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, notes, currency)
  VALUES (gen_random_uuid(), comp_id, c2, 'invoice',
          public.next_document_number(comp_id, 'invoice', 'FAC'),
          'partial', CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '15 days',
          2500000, 450000, 2950000, '[TEST DATA] Facture avec acompte 30% — démo paiement partiel', 'XOF')
  RETURNING id INTO inv2;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
    (inv2, 'Refonte site corporate', 1, 1500000, 18, 'forfait'),
    (inv2, 'Hébergement annuel', 1, 1000000, 18, 'forfait');
  INSERT INTO public.payments (invoice_id, amount, method, reference, payment_date) VALUES
    (inv2, 885000, 'om', 'OM-REF-002', CURRENT_DATE - INTERVAL '10 days');

  -- 3. Facture envoyée non payée (dans les délais)
  INSERT INTO public.invoices (id, company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, notes, currency)
  VALUES (gen_random_uuid(), comp_id, c3, 'invoice',
          public.next_document_number(comp_id, 'invoice', 'FAC'),
          'sent', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '10 days',
          250000, 45000, 295000, '[TEST DATA] Facture en cours de paiement', 'XOF')
  RETURNING id INTO inv3;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
    (inv3, 'Pack consulting 5h', 5, 50000, 18, 'heure');

  -- 4. Facture en RETARD (échéance dépassée)
  INSERT INTO public.invoices (id, company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, notes, currency)
  VALUES (gen_random_uuid(), comp_id, c4, 'invoice',
          public.next_document_number(comp_id, 'invoice', 'FAC'),
          'overdue', CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE - INTERVAL '15 days',
          600000, 108000, 708000, '[TEST DATA] Facture en retard — relance recommandée', 'XOF')
  RETURNING id INTO inv4;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
    (inv4, 'Formation équipe (2 jours)', 2, 300000, 18, 'jour');

  -- 5. Facture en EUR (multi-devises)
  INSERT INTO public.invoices (id, company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, notes, currency)
  VALUES (gen_random_uuid(), comp_id, c5, 'invoice',
          public.next_document_number(comp_id, 'invoice', 'FAC'),
          'sent', CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '27 days',
          5000, 900, 5900, '[TEST DATA] Facture export France — démo EUR', 'EUR')
  RETURNING id INTO inv5;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
    (inv5, 'Audit IT', 1, 5000, 18, 'forfait');

  -- 6. Brouillon
  INSERT INTO public.invoices (id, company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, notes, currency)
  VALUES (gen_random_uuid(), comp_id, c1, 'invoice',
          public.next_document_number(comp_id, 'invoice', 'FAC'),
          'draft', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
          120000, 21600, 141600, '[TEST DATA] Brouillon en cours de rédaction', 'XOF')
  RETURNING id INTO inv6;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
    (inv6, 'Consulting téléphonique', 2.4, 50000, 18, 'heure');

  -- ── DEVIS ──
  INSERT INTO public.invoices (id, company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, notes, currency)
  VALUES (gen_random_uuid(), comp_id, c2, 'estimate',
          public.next_document_number(comp_id, 'estimate', 'DEV'),
          'sent', CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE + INTERVAL '23 days',
          3500000, 630000, 4130000, '[TEST DATA] Devis projet refonte — en attente de validation', 'XOF')
  RETURNING id INTO est1;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
    (est1, 'Refonte plateforme e-commerce', 1, 2500000, 18, 'forfait'),
    (est1, 'Migration données', 1, 500000, 18, 'forfait'),
    (est1, 'Formation équipe', 1, 500000, 18, 'forfait');

  INSERT INTO public.invoices (id, company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, notes, currency)
  VALUES (gen_random_uuid(), comp_id, c4, 'estimate',
          public.next_document_number(comp_id, 'estimate', 'DEV'),
          'accepted', CURRENT_DATE - INTERVAL '12 days', CURRENT_DATE + INTERVAL '18 days',
          850000, 153000, 1003000, '[TEST DATA] Devis accepté — à convertir en facture', 'XOF')
  RETURNING id INTO est2;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
    (est2, 'Site vitrine + maintenance 12 mois', 1, 850000, 18, 'forfait');

  -- ── BON DE COMMANDE ──
  INSERT INTO public.invoices (id, company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, notes, currency)
  VALUES (gen_random_uuid(), comp_id, c5, 'purchase_order',
          public.next_document_number(comp_id, 'purchase_order', 'BC'),
          'sent', CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '28 days',
          1800000, 324000, 2124000, '[TEST DATA] Bon de commande matériel chantier', 'XOF')
  RETURNING id INTO bc1;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
    (bc1, 'Ciment Portland (sac 50kg)', 100, 8000, 18, 'sac'),
    (bc1, 'Fer à béton 12mm (barre 12m)', 50, 20000, 18, 'barre');

  -- ── BON DE LIVRAISON ──
  INSERT INTO public.invoices (id, company_id, client_id, type, number, status, issue_date, due_date,
                               subtotal_ht, total_tva, total_ttc, notes, currency)
  VALUES (gen_random_uuid(), comp_id, c5, 'delivery_note',
          public.next_document_number(comp_id, 'delivery_note', 'BL'),
          'sent', CURRENT_DATE, NULL,
          0, 0, 0, '[TEST DATA] Bon de livraison — réception matériel', 'XOF')
  RETURNING id INTO bl1;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, tva_rate, unit) VALUES
    (bl1, 'Ciment Portland (sac 50kg) — livré', 100, 0, 0, 'sac'),
    (bl1, 'Fer à béton 12mm — livré', 50, 0, 0, 'barre');

  RAISE NOTICE 'Données de test insérées : 5 clients, 4 produits, 6 factures (1 payée, 1 acompte, 1 envoyée, 1 retard, 1 EUR, 1 brouillon), 2 devis, 1 BC, 1 BL';
END $$;
