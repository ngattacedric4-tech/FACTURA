-- ============================================================================
-- FACTURA — Système d'activation par clé (Windows-style)
-- ============================================================================
-- Tables   : activation_keys, company_activations
-- Settings : platform_settings.activation_enforced (kill switch global)
-- RPCs     : admin_generate_key, activate_company, admin_revoke_key,
--            admin_extend_activation
-- Trigger  : auto 30j trial sur nouvelle entreprise
-- Backfill : 365j sur toutes entreprises existantes au déploiement
-- ============================================================================

-- 1. EXTENSIONS (déjà installées, idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. HELPER : check admin courant ---------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 3. TABLE : activation_keys --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activation_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL UNIQUE,
  plan          TEXT NOT NULL CHECK (plan IN ('starter','pro','business','enterprise')),
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  notes         TEXT,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_by       UUID REFERENCES public.companies(id),
  used_at       TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  revoked_by    UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_activation_keys_code   ON public.activation_keys(code);
CREATE INDEX IF NOT EXISTS idx_activation_keys_used   ON public.activation_keys(used_by);
CREATE INDEX IF NOT EXISTS idx_activation_keys_status ON public.activation_keys((used_at IS NULL), (revoked_at IS NULL));

-- 4. TABLE : company_activations ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_activations (
  company_id    UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  plan          TEXT NOT NULL CHECK (plan IN ('starter','pro','business','enterprise')) DEFAULT 'starter',
  activated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  last_key_id   UUID REFERENCES public.activation_keys(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_activations_exp ON public.company_activations(expires_at);

-- 5. RLS ---------------------------------------------------------------------
ALTER TABLE public.activation_keys     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_activations ENABLE ROW LEVEL SECURITY;

-- activation_keys : seuls les admins peuvent lire/écrire directement
DROP POLICY IF EXISTS "admin_only_keys_select" ON public.activation_keys;
CREATE POLICY "admin_only_keys_select" ON public.activation_keys
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admin_only_keys_modify" ON public.activation_keys;
CREATE POLICY "admin_only_keys_modify" ON public.activation_keys
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- company_activations : l'entreprise voit sa propre ligne, admin voit tout
DROP POLICY IF EXISTS "own_activation_select" ON public.company_activations;
CREATE POLICY "own_activation_select" ON public.company_activations
  FOR SELECT USING (
    public.is_admin()
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_only_activation_modify" ON public.company_activations;
CREATE POLICY "admin_only_activation_modify" ON public.company_activations
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6. SETTINGS : kill switch global -------------------------------------------
INSERT INTO public.platform_settings (key, value, updated_at)
VALUES ('activation_enforced', 'false', now())
ON CONFLICT (key) DO NOTHING;

-- platform_settings : lecture publique pour usePlatformSetting, écriture admin
DROP POLICY IF EXISTS "settings_public_read" ON public.platform_settings;
CREATE POLICY "settings_public_read" ON public.platform_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "settings_admin_write" ON public.platform_settings;
CREATE POLICY "settings_admin_write" ON public.platform_settings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 7. RPC : admin_generate_key ------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_generate_key(
  p_plan          TEXT,
  p_duration_days INTEGER,
  p_notes         TEXT DEFAULT NULL
) RETURNS TABLE (id UUID, code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_raw   BYTEA;
  v_hex   TEXT;
  v_code  TEXT;
  v_id    UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required';
  END IF;
  IF p_plan NOT IN ('starter','pro','business','enterprise') THEN
    RAISE EXCEPTION 'invalid_plan';
  END IF;
  IF p_duration_days IS NULL OR p_duration_days <= 0 THEN
    RAISE EXCEPTION 'invalid_duration';
  END IF;

  -- 8 octets = 16 hex = 64 bits → format XXXX-XXXX-XXXX-XXXX
  v_raw := extensions.gen_random_bytes(8);
  v_hex := upper(encode(v_raw, 'hex'));
  v_code := substr(v_hex,1,4) || '-' || substr(v_hex,5,4) || '-' ||
            substr(v_hex,9,4) || '-' || substr(v_hex,13,4);

  INSERT INTO public.activation_keys(code, plan, duration_days, notes, created_by)
  VALUES (v_code, p_plan, p_duration_days, p_notes, auth.uid())
  RETURNING activation_keys.id, activation_keys.code INTO v_id, v_code;

  RETURN QUERY SELECT v_id, v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_generate_key(TEXT,INTEGER,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_generate_key(TEXT,INTEGER,TEXT) TO authenticated;

-- 8. RPC : activate_company --------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_company(p_code TEXT)
RETURNS TABLE (plan TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key         public.activation_keys%ROWTYPE;
  v_company_id  UUID;
  v_normalized  TEXT;
  v_current     public.company_activations%ROWTYPE;
  v_new_expires TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT id INTO v_company_id
  FROM public.companies
  WHERE user_id = auth.uid();

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'no_company';
  END IF;

  -- normalisation : upper + tolère absence de tirets
  v_normalized := upper(regexp_replace(coalesce(p_code,''), '[^0-9A-Fa-f]', '', 'g'));
  IF length(v_normalized) <> 16 THEN
    RAISE EXCEPTION 'invalid_code_format';
  END IF;
  v_normalized := substr(v_normalized,1,4) || '-' || substr(v_normalized,5,4) || '-' ||
                  substr(v_normalized,9,4) || '-' || substr(v_normalized,13,4);

  -- lock la clé pour éviter double usage simultané
  SELECT * INTO v_key
  FROM public.activation_keys
  WHERE code = v_normalized
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'key_not_found';
  END IF;
  IF v_key.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'key_revoked';
  END IF;
  IF v_key.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'key_already_used';
  END IF;

  -- marquer clé utilisée
  UPDATE public.activation_keys
  SET used_by = v_company_id,
      used_at = now()
  WHERE id = v_key.id;

  -- expiration : extend si déjà active, sinon now()+duration
  SELECT * INTO v_current FROM public.company_activations WHERE company_id = v_company_id;

  IF FOUND AND v_current.expires_at > now() THEN
    v_new_expires := v_current.expires_at + (v_key.duration_days || ' days')::interval;
  ELSE
    v_new_expires := now() + (v_key.duration_days || ' days')::interval;
  END IF;

  INSERT INTO public.company_activations(company_id, plan, activated_at, expires_at, last_key_id, updated_at)
  VALUES (v_company_id, v_key.plan, now(), v_new_expires, v_key.id, now())
  ON CONFLICT (company_id) DO UPDATE
  SET plan         = EXCLUDED.plan,
      expires_at   = EXCLUDED.expires_at,
      last_key_id  = EXCLUDED.last_key_id,
      updated_at   = now();

  -- miroir vers subscriptions pour usePlan
  INSERT INTO public.subscriptions(company_id, plan, status, current_period_end)
  VALUES (v_company_id, v_key.plan, 'active', v_new_expires)
  ON CONFLICT (company_id) DO UPDATE
  SET plan               = EXCLUDED.plan,
      status             = 'active',
      current_period_end = EXCLUDED.current_period_end;

  RETURN QUERY SELECT v_key.plan, v_new_expires;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_company(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_company(TEXT) TO authenticated;

-- 9. RPC : admin_revoke_key --------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_revoke_key(p_key_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required';
  END IF;

  UPDATE public.activation_keys
  SET revoked_at = now(),
      revoked_by = auth.uid()
  WHERE id = p_key_id
    AND revoked_at IS NULL
    AND used_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'key_not_revokable';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revoke_key(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revoke_key(UUID) TO authenticated;

-- 10. RPC : admin_extend_activation ------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_extend_activation(
  p_company_id UUID,
  p_days       INTEGER
) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current     public.company_activations%ROWTYPE;
  v_new_expires TIMESTAMPTZ;
  v_plan        TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required';
  END IF;
  IF p_days IS NULL OR p_days = 0 THEN
    RAISE EXCEPTION 'invalid_days';
  END IF;

  SELECT * INTO v_current FROM public.company_activations WHERE company_id = p_company_id FOR UPDATE;

  IF NOT FOUND THEN
    v_new_expires := now() + (p_days || ' days')::interval;
    v_plan := 'starter';
    INSERT INTO public.company_activations(company_id, plan, activated_at, expires_at, updated_at)
    VALUES (p_company_id, v_plan, now(), v_new_expires, now());
  ELSE
    IF v_current.expires_at > now() THEN
      v_new_expires := v_current.expires_at + (p_days || ' days')::interval;
    ELSE
      v_new_expires := now() + (p_days || ' days')::interval;
    END IF;
    v_plan := v_current.plan;
    UPDATE public.company_activations
    SET expires_at = v_new_expires, updated_at = now()
    WHERE company_id = p_company_id;
  END IF;

  -- miroir subscriptions
  INSERT INTO public.subscriptions(company_id, plan, status, current_period_end)
  VALUES (p_company_id, v_plan, 'active', v_new_expires)
  ON CONFLICT (company_id) DO UPDATE
  SET current_period_end = EXCLUDED.current_period_end,
      status             = 'active';

  RETURN v_new_expires;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_extend_activation(UUID,INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_extend_activation(UUID,INTEGER) TO authenticated;

-- 11. TRIGGER : nouvelle entreprise → 30j trial ------------------------------
CREATE OR REPLACE FUNCTION public.trg_new_company_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.company_activations(company_id, plan, activated_at, expires_at, updated_at)
  VALUES (NEW.id, 'starter', now(), now() + interval '30 days', now())
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_new_trial ON public.companies;
CREATE TRIGGER trg_companies_new_trial
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.trg_new_company_trial();

-- 12. BACKFILL : 365j pour les entreprises existantes ------------------------
INSERT INTO public.company_activations(company_id, plan, activated_at, expires_at, updated_at)
SELECT c.id,
       COALESCE(s.plan, 'starter'),
       now(),
       now() + interval '365 days',
       now()
FROM public.companies c
LEFT JOIN public.subscriptions s ON s.company_id = c.id
ON CONFLICT (company_id) DO NOTHING;

-- 13. FIN --------------------------------------------------------------------
-- Premier admin :
--   INSERT INTO public.admins(user_id) VALUES ('<TON_UUID_AUTH>') ON CONFLICT DO NOTHING;
-- Activer le blocage en production :
--   UPDATE public.platform_settings SET value='true', updated_at=now() WHERE key='activation_enforced';
