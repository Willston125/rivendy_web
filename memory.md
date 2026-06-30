# Rivendy Web App - Memory & Status

## Présentation du Projet
Rivendy est une plateforme de marketplace (Mise en relation Acheteurs/Vendeurs) opérant de façon multi-marchés (Comores, Djibouti, etc.), disposant d'une application mobile (Flutter) et d'une version web (Next.js). L'objectif est d'avoir une **parité parfaite** entre les fonctionnalités de l'App mobile et du Site Web.

## Technologies
- **Frontend** : Next.js 15 (App Router), React, Tailwind CSS, Lucide React
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
- **Déverrouillage des gains du Portefeuille** : Correction des calculs dans `wallet-view.tsx` pour inclure les commandes au statut `delivered_confirmed` dans le solde confirmé des vendeurs.
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

## Prochaines Étapes Envisagées
1. **Recherche par image** : Actuellement en mode maquette UI sur Flutter, à évaluer pour implémentation via ML ou API externe.
2. **Page Promo exclusive** : Création d'une page enrichie pour les promotions de la plateforme.
3. **Paiement Mobile** : Intégration ou renforcement des API de paiement mobile local (Djibouti, Comores) si nécessaire à l'avenir.

*Dernière mise à jour : 26 Juin 2026 (Après Audit Complet & Correction Hooks)*
