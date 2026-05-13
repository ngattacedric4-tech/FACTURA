-- MIGRATION 002: avances (down-payments) sur factures
-- Cas d'usage: chefs de chantier, prestations longues — client verse une avance à la signature.

BEGIN;

-- 1. Colonnes d'avance sur la facture (snapshot dénormalisé)
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS advance_amount NUMERIC(15, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS advance_date DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS advance_method TEXT
    CHECK (advance_method IS NULL OR advance_method IN ('wave', 'om', 'mtn', 'cash', 'transfer', 'check'));
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS advance_reference TEXT;

-- 2. Garde-fou: avance ne peut pas dépasser le total TTC
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_advance_lte_total;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_advance_lte_total
    CHECK (advance_amount >= 0 AND advance_amount <= total_ttc);

-- 3. Trigger: auto-créer une ligne dans `payments` quand une avance est saisie à la création
--    Garde la table `payments` comme source unique pour l'agrégat encaissements.
CREATE OR REPLACE FUNCTION public.sync_advance_to_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.advance_amount > 0 AND NEW.advance_method IS NOT NULL THEN
        INSERT INTO public.payments (invoice_id, amount, method, reference, payment_date)
        VALUES (
            NEW.id,
            NEW.advance_amount,
            NEW.advance_method,
            COALESCE(NEW.advance_reference, 'Avance à la commande'),
            COALESCE(NEW.advance_date, CURRENT_DATE)
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_advance_to_payment ON public.invoices;
CREATE TRIGGER trg_sync_advance_to_payment
    AFTER INSERT ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_advance_to_payment();

-- 4. Index pour le calcul de solde restant côté liste factures
CREATE INDEX IF NOT EXISTS idx_invoices_advance ON public.invoices(advance_amount) WHERE advance_amount > 0;

-- Note: le statut 'partial' n'a pas besoin de migration — la colonne `status` est TEXT libre.
--       Le code applicatif l'utilise désormais comme valeur additionnelle.

COMMIT;
