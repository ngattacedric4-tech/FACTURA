-- ACTIVATION SYSTEM — supabase_activation.sql
-- Système d'activation manuelle par clé unique (paiement hors-ligne via WhatsApp/email).
-- Idempotent. À exécuter dans Supabase SQL Editor APRÈS supabase_setup.sql + supabase_plans.sql.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ──────────────────────────────────────────────────────────────────────────
-- PRE-CLEAN — drop toutes signatures existantes des RPCs (return-type immutable)
-- Doit tourner AVANT toute CREATE FUNCTION ci-dessous, sinon ERROR 42P13.
-- ──────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_generate_key(text, integer, text) CASCADE;
DROP FUNCTION IF EXISTS public.admin_generate_key(text, int, text)     CASCADE;
DROP FUNCTION IF EXISTS public.admin_generate_key(text, integer)       CASCADE;
DROP FUNCTION IF EXISTS public.admin_generate_key(text)                CASCADE;
DROP FUNCTION IF EXISTS public.activate_company(text)                  CASCADE;
DROP FUNCTION IF EXISTS public.admin_revoke_key(uuid)                  CASCADE;
DROP FUNCTION IF EXISTS public.admin_extend_activation(uuid, integer)  CASCADE;
DROP FUNCTION IF EXISTS public.admin_extend_activation(uuid, int)      CASCADE;

-- Filet de sécurité : drop toute variante restante (signature inconnue)
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure::text AS sig FROM pg_proc
           WHERE proname IN ('admin_generate_key','activate_company','admin_revoke_key','admin_extend_activation')
             AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 0. ADMINS — requis pour RLS (manquait dans schéma original)
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- Idempotent : si table déjà créée par version antérieure
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS notes      TEXT;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now() NOT NULL;

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read admins" ON public.admins;
CREATE POLICY "Admins read admins" ON public.admins
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins manage admins" ON public.admins;
CREATE POLICY "Admins manage admins" ON public.admins
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

-- ──────────────────────────────────────────────────────────────────────────
-- 1. PLATFORM_SETTINGS — clés de config (kill switch, etc.)
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS value      TEXT;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now() NOT NULL;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Admins : lecture/écriture toutes clés
DROP POLICY IF EXISTS "Admins read all settings" ON public.platform_settings;
CREATE POLICY "Admins read all settings" ON public.platform_settings
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins write settings" ON public.platform_settings;
CREATE POLICY "Admins write settings" ON public.platform_settings
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- Tous authentifiés : lecture du flag activation_enforced uniquement
DROP POLICY IF EXISTS "Auth read activation_enforced" ON public.platform_settings;
CREATE POLICY "Auth read activation_enforced" ON public.platform_settings
  FOR SELECT TO authenticated
  USING (key = 'activation_enforced');

-- Kill switch (Option B) : OFF par défaut, admin l'active quand prêt
INSERT INTO public.platform_settings (key, value)
VALUES ('activation_enforced', 'false')
ON CONFLICT (key) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. ACTIVATION_KEYS — clés générées par admin, en attente d'usage
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activation_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,
  plan            TEXT NOT NULL DEFAULT 'pro'
                    CHECK (plan IN ('starter','pro','business','enterprise')),
  duration_days   INT NOT NULL DEFAULT 30 CHECK (duration_days BETWEEN 1 AND 3650),
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  used_at         TIMESTAMPTZ,
  used_by_company UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  revoked         BOOLEAN NOT NULL DEFAULT false
);
-- Idempotent : ajoute colonnes manquantes si table partiellement créée auparavant
ALTER TABLE public.activation_keys ADD COLUMN IF NOT EXISTS plan            TEXT NOT NULL DEFAULT 'pro';
ALTER TABLE public.activation_keys ADD COLUMN IF NOT EXISTS duration_days   INT  NOT NULL DEFAULT 30;
ALTER TABLE public.activation_keys ADD COLUMN IF NOT EXISTS notes           TEXT;
ALTER TABLE public.activation_keys ADD COLUMN IF NOT EXISTS created_by      UUID REFERENCES auth.users(id);
ALTER TABLE public.activation_keys ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ DEFAULT now() NOT NULL;
ALTER TABLE public.activation_keys ADD COLUMN IF NOT EXISTS used_at         TIMESTAMPTZ;
ALTER TABLE public.activation_keys ADD COLUMN IF NOT EXISTS used_by_company UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.activation_keys ADD COLUMN IF NOT EXISTS revoked         BOOLEAN NOT NULL DEFAULT false;

-- (re)applique CHECKs (drop+add pour cas de constraint manquante)
ALTER TABLE public.activation_keys DROP CONSTRAINT IF EXISTS activation_keys_plan_check;
ALTER TABLE public.activation_keys ADD  CONSTRAINT activation_keys_plan_check CHECK (plan IN ('starter','pro','business','enterprise'));
ALTER TABLE public.activation_keys DROP CONSTRAINT IF EXISTS activation_keys_duration_days_check;
ALTER TABLE public.activation_keys ADD  CONSTRAINT activation_keys_duration_days_check CHECK (duration_days BETWEEN 1 AND 3650);

CREATE INDEX IF NOT EXISTS idx_activation_keys_code    ON public.activation_keys(code);
CREATE INDEX IF NOT EXISTS idx_activation_keys_status  ON public.activation_keys(revoked, used_at);
CREATE INDEX IF NOT EXISTS idx_activation_keys_company ON public.activation_keys(used_by_company);

ALTER TABLE public.activation_keys ENABLE ROW LEVEL SECURITY;

-- Admins UNIQUEMENT en lecture/écriture directe (pas d'énumération possible par user)
-- L'activation user passe par la RPC SECURITY DEFINER ci-dessous.
DROP POLICY IF EXISTS "Admins manage keys" ON public.activation_keys;
CREATE POLICY "Admins manage keys" ON public.activation_keys
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- ──────────────────────────────────────────────────────────────────────────
-- 3. COMPANY_ACTIVATIONS — état activation 1:1 par société
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_activations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID UNIQUE NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  current_key_id  UUID REFERENCES public.activation_keys(id) ON DELETE SET NULL,
  plan            TEXT NOT NULL DEFAULT 'starter',
  activated_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  renewed_count   INT NOT NULL DEFAULT 0,
  last_renewed_at TIMESTAMPTZ
);
-- Idempotent
ALTER TABLE public.company_activations ADD COLUMN IF NOT EXISTS current_key_id  UUID REFERENCES public.activation_keys(id) ON DELETE SET NULL;
ALTER TABLE public.company_activations ADD COLUMN IF NOT EXISTS plan            TEXT NOT NULL DEFAULT 'starter';
ALTER TABLE public.company_activations ADD COLUMN IF NOT EXISTS activated_at    TIMESTAMPTZ DEFAULT now() NOT NULL;
ALTER TABLE public.company_activations ADD COLUMN IF NOT EXISTS expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days');
ALTER TABLE public.company_activations ADD COLUMN IF NOT EXISTS renewed_count   INT NOT NULL DEFAULT 0;
ALTER TABLE public.company_activations ADD COLUMN IF NOT EXISTS last_renewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_company_activations_company ON public.company_activations(company_id);
CREATE INDEX IF NOT EXISTS idx_company_activations_expires ON public.company_activations(expires_at);

ALTER TABLE public.company_activations ENABLE ROW LEVEL SECURITY;

-- User : LECTURE seule de sa propre ligne. Aucune écriture directe (forcer RPC).
DROP POLICY IF EXISTS "User reads own activation" ON public.company_activations;
CREATE POLICY "User reads own activation" ON public.company_activations
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );

-- Admins : full access (audit / override manuel si besoin)
DROP POLICY IF EXISTS "Admins manage activations" ON public.company_activations;
CREATE POLICY "Admins manage activations" ON public.company_activations
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- ──────────────────────────────────────────────────────────────────────────
-- 4. RPC admin_generate_key — admin génère une nouvelle clé
-- ──────────────────────────────────────────────────────────────────────────
-- Drop toutes signatures existantes (return type ne peut pas changer via REPLACE)
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure::text AS sig FROM pg_proc
           WHERE proname = 'admin_generate_key' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.admin_generate_key(
  p_plan          TEXT,
  p_duration_days INT  DEFAULT 30,
  p_notes         TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code     TEXT;
  v_hex      TEXT;
  v_attempts INT := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé : admins uniquement';
  END IF;
  IF p_plan NOT IN ('starter','pro','business','enterprise') THEN
    RAISE EXCEPTION 'Plan invalide : %', p_plan;
  END IF;
  IF p_duration_days < 1 OR p_duration_days > 3650 THEN
    RAISE EXCEPTION 'Durée invalide : % jours', p_duration_days;
  END IF;

  LOOP
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Échec génération clé unique (collision répétée)';
    END IF;
    v_hex := upper(encode(gen_random_bytes(8), 'hex'));  -- 16 chars hex = 64 bits
    v_code := 'FACT-'
              || substr(v_hex,1,4)  || '-'
              || substr(v_hex,5,4)  || '-'
              || substr(v_hex,9,4)  || '-'
              || substr(v_hex,13,4);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.activation_keys WHERE code = v_code);
  END LOOP;

  INSERT INTO public.activation_keys (code, plan, duration_days, notes, created_by)
  VALUES (v_code, p_plan, p_duration_days, p_notes, auth.uid());

  RETURN v_code;
END $$;

REVOKE ALL ON FUNCTION public.admin_generate_key(TEXT, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_generate_key(TEXT, INT, TEXT) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 5. RPC activate_company — user active/renouvelle son compte
-- ──────────────────────────────────────────────────────────────────────────
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure::text AS sig FROM pg_proc
           WHERE proname = 'activate_company' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.activate_company(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user        UUID := auth.uid();
  v_company_id  UUID;
  v_key         public.activation_keys;
  v_current     public.company_activations;
  v_base        TIMESTAMPTZ;
  v_new_expires TIMESTAMPTZ;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT id INTO v_company_id
  FROM public.companies WHERE user_id = v_user;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Société introuvable. Complétez d''abord votre profil entreprise.';
  END IF;

  -- Lock la clé pour empêcher double-spend si deux onglets cliquent en parallèle
  SELECT * INTO v_key
  FROM public.activation_keys
  WHERE code = upper(trim(p_code))
    AND used_at IS NULL
    AND revoked = false
  FOR UPDATE;

  IF v_key.id IS NULL THEN
    RAISE EXCEPTION 'Clé invalide, déjà utilisée ou révoquée';
  END IF;

  SELECT * INTO v_current
  FROM public.company_activations WHERE company_id = v_company_id;

  -- Extend si encore valide, sinon démarre à now()
  v_base := GREATEST(COALESCE(v_current.expires_at, now()), now());
  v_new_expires := v_base + (v_key.duration_days || ' days')::INTERVAL;

  INSERT INTO public.company_activations (
    company_id, current_key_id, plan, activated_at, expires_at, last_renewed_at, renewed_count
  )
  VALUES (
    v_company_id, v_key.id, v_key.plan, COALESCE(v_current.activated_at, now()),
    v_new_expires, now(), COALESCE(v_current.renewed_count, 0)
  )
  ON CONFLICT (company_id) DO UPDATE SET
    current_key_id  = EXCLUDED.current_key_id,
    plan            = EXCLUDED.plan,
    expires_at      = EXCLUDED.expires_at,
    last_renewed_at = now(),
    renewed_count   = public.company_activations.renewed_count + 1;

  -- Sync table subscriptions (utilisée par usePlan)
  UPDATE public.subscriptions
  SET plan = v_key.plan, current_period_end = v_new_expires, status = 'active'
  WHERE company_id = v_company_id;

  -- Marquer clé consommée
  UPDATE public.activation_keys
  SET used_at = now(), used_by_company = v_company_id
  WHERE id = v_key.id;

  RETURN jsonb_build_object(
    'success',       true,
    'plan',          v_key.plan,
    'expires_at',    v_new_expires,
    'duration_days', v_key.duration_days
  );
END $$;

REVOKE ALL ON FUNCTION public.activate_company(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_company(TEXT) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 6. RPC admin_revoke_key — révoquer une clé non encore utilisée
-- ──────────────────────────────────────────────────────────────────────────
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure::text AS sig FROM pg_proc
           WHERE proname = 'admin_revoke_key' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.admin_revoke_key(p_key_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé : admins uniquement';
  END IF;
  UPDATE public.activation_keys
  SET revoked = true
  WHERE id = p_key_id AND used_at IS NULL;
END $$;

REVOKE ALL ON FUNCTION public.admin_revoke_key(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revoke_key(UUID) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 7. RPC admin_extend_activation — admin prolonge manuellement (geste commercial)
-- ──────────────────────────────────────────────────────────────────────────
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure::text AS sig FROM pg_proc
           WHERE proname = 'admin_extend_activation' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.admin_extend_activation(p_company_id UUID, p_days INT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_expires TIMESTAMPTZ;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé : admins uniquement';
  END IF;
  IF p_days < 1 OR p_days > 3650 THEN
    RAISE EXCEPTION 'Durée invalide';
  END IF;

  UPDATE public.company_activations
  SET expires_at      = GREATEST(expires_at, now()) + (p_days || ' days')::INTERVAL,
      last_renewed_at = now()
  WHERE company_id = p_company_id
  RETURNING expires_at INTO v_new_expires;

  IF v_new_expires IS NULL THEN
    RAISE EXCEPTION 'Aucune activation existante pour cette société';
  END IF;

  UPDATE public.subscriptions
  SET current_period_end = v_new_expires
  WHERE company_id = p_company_id;

  RETURN v_new_expires;
END $$;

REVOKE ALL ON FUNCTION public.admin_extend_activation(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_extend_activation(UUID, INT) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 8. BACKFILL (Option A) — 365j gracieux pour sociétés existantes
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO public.company_activations (company_id, plan, expires_at, activated_at)
SELECT
  c.id,
  COALESCE(s.plan, 'starter'),
  now() + INTERVAL '365 days',
  now()
FROM public.companies c
LEFT JOIN public.subscriptions s        ON s.company_id = c.id
LEFT JOIN public.company_activations ca ON ca.company_id = c.id
WHERE ca.company_id IS NULL;

-- ──────────────────────────────────────────────────────────────────────────
-- 9. TRIGGER — auto-trial 30j pour nouvelles sociétés (UX onboarding)
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_trial_activation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.company_activations (company_id, plan, expires_at, activated_at)
  VALUES (NEW.id, 'starter', now() + INTERVAL '30 days', now())
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS auto_trial_on_company ON public.companies;
CREATE TRIGGER auto_trial_on_company
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.auto_trial_activation();
