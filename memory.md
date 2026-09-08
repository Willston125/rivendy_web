# Rivendy Web App - Memory & Status

## Présentation du Projet
Rivendy est une plateforme de marketplace (Mise en relation Acheteurs/Vendeurs) opérant de façon multi-marchés (Comores, Djibouti, etc.), disposant d'une application mobile (Flutter) et d'une version web (Next.js). L'objectif est d'avoir une **parité parfaite** entre les fonctionnalités de l'App mobile et du Site Web.

## Technologies
- **Frontend** : Next.js 16.2.10 (App Router), React 19, Tailwind CSS, Lucide React
- **Backend / BDD** : Supabase (PostgreSQL, Authentification, Storage)
- **Déploiement** : Vercel (Front) & GitHub (Code source)

---

## Dernières Corrections Majeures & Audit (Juin 2026)

Un audit complet a été réalisé pour résoudre les bugs bloquants, les incohérences de logique métier et les problèmes d'affichage géolocalisé :

### 1. Fiabilisation du sélecteur de pays & Élimination des fallbacks codés en dur
- **Correction du Bug de Sélection Géographique** : Les utilisateurs de certaines régions (ex: Comores) étaient systématiquement redirigés vers le marché de Djibouti. Nous avons modifié `country-provider.tsx` et `market-url-sync.tsx` afin de stocker et synchroniser proprement le pays via localStorage, profil Supabase, et paramètres d'URL (`?country=`).
- **Suppression des valeurs "en dur" (Hardcodes)** : Remplacement de toutes les occurrences de `"DJ"` et `"FDJ"` dans les formulaires de checkout, pages de produits, pages vendeurs, et utilitaires de formatage par des variables dynamiques issues du pays sélectionné.

### 2. Résolution des Hook Violations (React Rules)
- **Problème** : 14 composants (dont `orders-view.tsx`, `wallet-view.tsx`, `seller-dashboard.tsx`) retournaient un rendu prématuré (`if (!country) return null;`) avant d'appeler les hooks `useState` et `useEffect`. Cela brisait les règles de cycle de vie de React et provoquait des erreurs au re-rendu.
- **Correction** : Les gardes conditionnelles ont été déplacées après tous les hooks d'état et d'effets de chaque composant, en sécurisant les accès aux propriétés (`country?.id` ou `country?.currency_code`).

### 3. Logique Métier Portefeuille & Statut de Livraison
- **Synchronisation du statut `delivered_confirmed`** : Ce statut (marqué par l'admin via RPC pour valider les codes de livraison à 6 chiffres) était ignoré sur le Web. Il a été ajouté dans le système de types, le filtrage des commandes acheteurs (`orders-view.tsx`), et le dashboard vendeur (`seller-dashboard.tsx`, `seller-sales-view.tsx`).
- **Portefeuille (`wallet-view.tsx`) — corrigé réellement le 2026-08-22** : la version précédente de cette note annonçait une correction absente du code. Depuis le commit `4d1383d` : le compteur « Livrées » lit `status` (`completed`/`delivered`/`delivered_by_rider`/`delivered_confirmed` — même convention que `seller-dashboard`), les commandes annulées sont exclues des gains en attente, et le solde confirmé vient exclusivement de `wallets.balance` (serveur).
- **Sidebar dynamique** : Le solde affiché dans la barre latérale gauche (`left-sidebar.tsx`) a été rendu dynamique en requêtant directement Supabase au lieu d'afficher une valeur hardcodée (`12450`).

### 4. Validation Technique
- Le projet compile avec succès sans aucune erreur TypeScript (`npx tsc --noEmit` validé à 0 erreur).

---

## Fonctionnalités Implémentées (Parité Web/App)

### 1. Expérience Client (Acheteur)
- **Catalogue & Recherche** : 
  - Filtre par sous-catégories (SubcategoryFilter).
  - Onglet de recherche mis à jour avec les mêmes filtres.
- **Sélecteur de Marché** : Intégration du sélecteur de pays/marché en Header Desktop (sauvegardé en `localStorage`).
- **Supermarché (Alimentation)** : Mise en page spécifique `FoodCard` pour la catégorie "Alimentation" et "Restaurant".
- **Code de Livraison** : Modal pour saisir le code de livraison à 6 chiffres (confirmation de réception).
- **Signalement (Report)** : Bouton et modal pour signaler un produit inapproprié ou un vendeur (`product_reports` et `seller_reports`).

### 2. Expérience Vendeur
- **Gestion des Commandes** : Nouvel onglet "Commandes" dans la Garde-Robe (`seller-sales-view.tsx`) avec la possibilité de contacter l'acheteur directement sur WhatsApp.
- **Stories** : Bouton "Story" pour mettre en avant temporairement un produit.
- **Réseaux Sociaux** : Les vendeurs peuvent ajouter leurs liens Facebook, Instagram, et TikTok sur leur profil.
- **Création de Boutique** : Adaptation du formulaire de création pour masquer l'état des produits (Neuf/Occasion) si la catégorie est Restaurant ou Alimentation.
- **Vendeur Certifié** : Ajout du badge vérifié (Check bleu/vert) sur les fiches produits des vendeurs certifiés.
- **Impression Catalogue** : Page dédiée pour imprimer son catalogue de produits avec un QR Code (CSS `@media print`).

### 3. Interface Globale & UI
- **Partage** : Boutons natifs pour partager une boutique ou un produit.
- **Pied de page (LeftSidebar)** : Ajout des liens vers les réseaux sociaux officiels de Rivendy et intégration dynamique du solde.
- **Pages Légales** : CGU et Politique de confidentialité consultables à `/legal`.

---

## Base de données (Supabase)
Les migrations suivantes ont été ajoutées pour synchroniser les schémas Web et Flutter :
- `20260509_rivendy_web_compat.sql` : Patch idempotent pour les statuts (`pending`, `epuise`, `rejected`) et les catégories (`restaurant`, `location`, `mariage`, `personnels`).
- `20260605_product_reports.sql` : Table de signalement des produits.
- `20260606_seller_reports.sql` : Table de signalement des vendeurs.
- `20260606_social_links.sql` : Ajout des colonnes `facebook_url`, `instagram_url`, `tiktok_url` sur la table `profiles`.
- `20260517_admin_verify_delivery_rpc.sql` : Procédure stockée d'authentification par code de livraison.

---

## Stabilisation du 2026-08-22 (mission post-audit)

- **Paiements vendeur par marché** (`lib/utils/mobile-money.ts`, miroir EXACT de
  `rivendy_app/lib/core/utils/mobile_money_data.dart` — modifier les DEUX ensemble) :
  fin des numéros factices de l'abonnement (`+253 77 00 00 0x`) et des numéros
  Djibouti codés en dur du boost. Modals en 4 étapes à parité app ; sans numéro
  configuré pour un marché → parcours espèces/WhatsApp de l'agence locale,
  jamais de fallback Djibouti silencieux.
- **Crédits boost inclus** : carte « Boost inclus » branchée sur les RPC serveur
  `get_boost_credit_status` / `use_boost_credit` (décompte 100 % serveur,
  produit `active` uniquement).
- **Plan D déployé** : lecteur vidéo sur la fiche produit (`product-video-player.tsx`).
- **Migrations** : `supabase/migrations/` de ce dépôt est ARCHIVÉ (voir son
  README) — propriétaire unique : `rivendy_dashboard/supabase/migrations/`.

## Prochaines Étapes Envisagées
1. **Recherche par image** : Actuellement en mode maquette UI sur Flutter, à évaluer pour implémentation via ML ou API externe.
2. **Page Promo exclusive** : Création d'une page enrichie pour les promotions de la plateforme.
3. **Paiement Mobile** : Intégration ou renforcement des API de paiement mobile local (Djibouti, Comores) si nécessaire à l'avenir.
4. **Parité vidéo restante** : badge vidéo sur les cartes produit, stories vidéo dans `story-viewer.tsx`.

## Sécurisation post-audit du 2026-09-08

- **Produits vendeurs** : création normale et création en lot envoyées en
  `pending`. Le marché actif est persisté avant l'insertion ; le prix vendeur
  est positif et Supabase recalcule la commission et le prix affiché.
- **Édition du prix** : passage obligatoire par
  `seller_update_product_price()` ; un échec RPC ne peut plus produire de faux
  message de réussite.
- **Catégories Rivendy** : `alimentation`, `hotel` et `pharmacie` sont retirées
  des formulaires vendeurs via `RIVENDY_MANAGED_CATEGORY_IDS`, avec contrôle de
  non-régression dans `npm run check`.
- **Commentaires** : likes et signalements passent par les RPC dédiées ; l'état
  des likes est relu depuis Supabase, et le client ne modifie plus directement
  les compteurs.
- **Stock nul** : la fiche produit reste accessible en état « Épuisé », sans
  possibilité d'achat, au lieu de renvoyer une 404.
- **Accessibilité/sécurité HTTP** : modal marché avec sémantique dialog et focus
  confiné, formulaires d'authentification nommés, cibles mobiles de 44 px,
  `unsafe-eval` limité au développement.
- **Validation** : `npm run check` réussi le 2026-09-08 — TypeScript et ESLint
  sans erreur, contrôles catégories/sécurité verts ; 33 avertissements non
  bloquants restent à traiter séparément.
- **Backend partagé** : les migrations propriétaires sont dans
  `rivendy_dashboard/supabase/migrations/20260908_product_insert_hardening.sql`
  et `20260908_product_comments_hardening.sql`. Leur exécution en production a
  été confirmée par le propriétaire le 2026-09-08.

## Parité boutique App/Web du 2026-09-09

- **Source de couverture unique** : l'app Flutter et le site lisent et écrivent
  désormais `profiles.store_banner_url`. La colonne historique
  `store_banner_url_web` ne doit plus être utilisée par le code client.
- **Catalogue unique** : les boutiques web lisent `visible_products`, comme
  Flutter, avec le même filtre `seller_id`, le même marché et les règles serveur
  communes pour statuts, suppressions et précommandes. Les produits vendus ou
  épuisés ne sont plus injectés dans la vitrine publique web.
- **Vidéo de couverture** : le site reprend la vidéo prête des vendeurs
  certifiés lorsque ses colonnes sont lisibles publiquement, avec repli sûr sur
  la photo partagée si Supabase les refuse.
- **Catalogue imprimable** : l'URL du QR code est fournie par le serveur afin
  d'éviter le décalage d'hydratation entre `rivendy.com` et l'origine locale.
- **Validation** : `npm run check` réussi (0 erreur, 33 avertissements
  préexistants), boutique réelle contrôlée localement avec réponse HTTP 200.

*Dernière mise à jour : 9 septembre 2026 (parité boutique App/Web)*
