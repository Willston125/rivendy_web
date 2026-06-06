-- ======================================================================
-- PILIERS DE PERFORMANCE VENDEUR (parité app → site)
-- ----------------------------------------------------------------------
-- L'app calcule 3 piliers dans trust_score_service.dart en lisant la
-- table `orders` (accès réservé aux parties par RLS). Le site public est
-- anonyme et ne peut PAS lire `orders` → on expose une agrégation sûre
-- via une RPC SECURITY DEFINER qui ne renvoie QUE des indicateurs (aucune
-- donnée nominative de commande).
--
--   A. Préparation  : délai moyen created_at → expédition (≤ 72h)
--   B. Conformité   : % commandes livrées sans signalement non-conformité
--   C. Réponse      : NULL pour l'instant (nécessite la messagerie) — comme l'app
--
-- Calculé sur les 100 dernières commandes du vendeur.
-- Idempotent.
-- ======================================================================

CREATE OR REPLACE FUNCTION public.get_vendor_pillars(p_seller_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH recent AS (
    SELECT status, created_at, updated_at, shipped_at, non_conformity_reported
    FROM public.orders
    WHERE seller_id = p_seller_id
    ORDER BY created_at DESC
    LIMIT 100
  ),
  prep AS (
    SELECT EXTRACT(EPOCH FROM (COALESCE(shipped_at, updated_at) - created_at)) / 3600.0 AS h
    FROM recent
    WHERE created_at IS NOT NULL
      AND COALESCE(shipped_at, updated_at) IS NOT NULL
      AND status IN (
        'shipped', 'delivered', 'completed', 'delivered_by_rider',
        'picked_up', 'en_route', 'assigned_to_delivery',
        'accepted_by_agent', 'arrived'
      )
  ),
  prep_valid AS (
    SELECT h FROM prep WHERE h > 0 AND h <= 72
  ),
  delivered AS (
    SELECT
      count(*)                                            AS total,
      count(*) FILTER (WHERE non_conformity_reported)      AS bad
    FROM recent
    WHERE status IN ('delivered', 'completed', 'delivered_by_rider')
  )
  SELECT json_build_object(
    'total_orders',          (SELECT count(*) FROM recent),
    'delivered_orders',      (SELECT total FROM delivered),
    'avg_preparation_hours', (SELECT round(avg(h)::numeric, 1) FROM prep_valid),
    'conformity_rate',
      (SELECT CASE WHEN total > 0
                THEN round(((total - bad)::numeric / total) * 100, 1)
                ELSE NULL END
       FROM delivered),
    'response_rate',         NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_vendor_pillars(uuid) TO anon, authenticated;
