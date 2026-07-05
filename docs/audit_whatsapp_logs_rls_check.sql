-- =====================================================================
--  Vérification RLS — table whatsapp_logs (P2-6, lecture seule)
--
--  Le web insère dans whatsapp_logs depuis le CLIENT (anon/authenticated,
--  checkout-form.tsx) : country_id, phone_number, message_type, order_id,
--  recipient_name — pas de contenu sensible, mais un INSERT anon non
--  restreint pourrait permettre du spam/pollution de la table.
--  Colle ce script (une requête à la fois) dans Supabase → SQL Editor.
-- =====================================================================

-- Q1 — RLS activée ?
SELECT relrowsecurity AS rls_active
FROM pg_class WHERE relname = 'whatsapp_logs';

-- Q2 — Policies existantes
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'whatsapp_logs';

-- Attendu : soit RLS off + table réservée aux logs non sensibles (acceptable
-- vu le contenu inoffensif), soit une policy INSERT restreinte à
-- order_id existant (anti-spam). Rien de critique si rien n'est trouvé —
-- ce n'est qu'une table de log, pas une source de vérité financière.
