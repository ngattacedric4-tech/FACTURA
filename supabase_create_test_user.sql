-- CRÉE UN COMPTE TEST CONFIRMÉ — à exécuter dans Supabase SQL Editor
-- Identifiants:
--   Email    : test@factura.ci
--   Password : Test1234!

DO $$
DECLARE
  uid UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    uid, 'authenticated', 'authenticated',
    'test@factura.ci',
    crypt('Test1234!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false, '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), uid,
    jsonb_build_object('sub', uid::text, 'email', 'test@factura.ci', 'email_verified', true),
    'email', uid::text,
    now(), now(), now()
  );
END $$;

SELECT 'Compte test créé : test@factura.ci / Test1234!' AS message;
