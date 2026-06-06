-- ======================================================================
-- FIX SYNCHRO APP ↔ SITE WEB : lecture publique des produits
-- ----------------------------------------------------------------------
-- Problème constaté (2026-06-06) :
--   Le rôle `anon` (utilisé par tout le site public en SSR) ne pouvait
--   lire AUCUNE ligne de `public.products` → le site affichait
--   « Aucun produit », stories incluses, alors que l'app (utilisateurs
--   authentifiés) voit tout. Les tables `countries`, `profiles`,
--   `product_comments` étaient lisibles, mais pas `products` :
--   la policy `products_select_all` (prévue dans init_database.sql,
--   `USING (TRUE)`) était absente / droppée en production.
--
-- La vue `public.visible_products` (feed home) est en `security_invoker`,
-- donc elle respecte la RLS de `products` : sans policy SELECT pour anon,
-- elle renvoie 0 ligne. Idem pour `getStoryProducts` qui lit la table
-- `products` directement.
--
-- Correctif : (re)créer la policy SELECT publique + garantir les GRANT.
-- Idempotent — peut être rejoué sans risque.
-- ======================================================================

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Lecture publique de tous les produits (comportement d'origine).
-- Le site filtre déjà les statuts côté requête (vue visible_products =
-- active/boosted + stock>0 ; stories = active/boosted/validated/pending).
DROP POLICY IF EXISTS "products_select_all" ON public.products;
CREATE POLICY "products_select_all"
    ON public.products
    FOR SELECT
    USING (TRUE);

-- Garantit que les rôles publics ont bien le privilège SELECT sur la table
-- et sur la vue (la RLS reste la barrière de sécurité réelle).
GRANT SELECT ON public.products          TO anon, authenticated;
GRANT SELECT ON public.visible_products  TO anon, authenticated;

-- ----------------------------------------------------------------------
-- VARIANTE PLUS STRICTE (optionnelle) — si vous préférez n'exposer
-- publiquement que les produits réellement en vente, remplacez la policy
-- ci-dessus par celle-ci (le vendeur garde l'accès à ses propres produits) :
--
--   DROP POLICY IF EXISTS "products_select_all" ON public.products;
--   CREATE POLICY "products_select_public_or_owner"
--       ON public.products
--       FOR SELECT
--       USING (
--         status IN ('active', 'boosted', 'validated', 'pending', 'sold', 'epuise')
--         OR auth.uid() = seller_id
--       );
-- ----------------------------------------------------------------------
