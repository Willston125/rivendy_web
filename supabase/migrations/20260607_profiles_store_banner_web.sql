-- ======================================================================
-- COUVERTURE BOUTIQUE SPÉCIFIQUE AU SITE WEB
-- ----------------------------------------------------------------------
-- Le site web a un format de couverture large (différent de l'app). On
-- ajoute une colonne dédiée au web : l'app continue d'utiliser
-- `store_banner_url` (couverture inchangée), le web utilise en priorité
-- `store_banner_url_web` et retombe sur `store_banner_url` si vide.
-- Colonne nullable → aucune incidence sur l'app (qui ne la lit jamais).
-- Idempotent.
-- ======================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS store_banner_url_web text;
