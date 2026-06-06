# Rivendy Web App - Memory & Status

## Présentation du Projet
Rivendy est une plateforme de marketplace (Mise en relation Acheteurs/Vendeurs) opérant à Djibouti, disposant d'une application mobile (Flutter) et d'une version web (Next.js). L'objectif est d'avoir une **parité parfaite** entre les fonctionnalités de l'App mobile et du Site Web.

## Technologies
- **Frontend** : Next.js 15 (App Router), React, Tailwind CSS, Lucide React
- **Backend / BDD** : Supabase (PostgreSQL, Authentification, Storage)
- **Déploiement** : Vercel (Front) & GitHub (Code source)

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
- **Pied de page (LeftSidebar)** : Ajout des liens vers les réseaux sociaux officiels de Rivendy.
- **Pages Légales** : CGU et Politique de confidentialité consultables à `/legal`.

---

## Base de données (Supabase)
Les migrations suivantes ont été ajoutées pour synchroniser les schémas Web et Flutter :
- `20260509_rivendy_web_compat.sql` : Patch idempotent pour les statuts (`pending`, `epuise`, `rejected`) et les catégories (`restaurant`, `location`, `mariage`, `personnels`).
- `20260605_product_reports.sql` : Table de signalement des produits.
- `20260606_seller_reports.sql` : Table de signalement des vendeurs.
- `20260606_social_links.sql` : Ajout des colonnes `facebook_url`, `instagram_url`, `tiktok_url` sur la table `profiles`.

---

## Prochaines Étapes Envisagées
1. **Recherche par image** : Actuellement en mode maquette UI sur Flutter, à évaluer pour implémentation via ML ou API externe.
2. **Page Promo exclusive** : Création d'une page enrichie pour les promotions de la plateforme.
3. **Paiement Mobile** : Intégration ou renforcement des API de paiement mobile local (Djibouti) si nécessaire à l'avenir.

*Dernière mise à jour : Juin 2026*
