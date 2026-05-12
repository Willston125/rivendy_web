# Rivendy Web App

MVP web marketplace Next.js pour Rivendy, cree dans `Ecommerce/rivendy_web` sans modifier l'app Flutter `vendy_app` ni le dashboard admin `nikey_dashboard`.

## Analyse rapide de l'app existante

- Flutter utilise `GoRouter` avec les routes principales `/home`, `/search`, `/favorites`, `/profile`, `/sell`, `/store/:sellerId`, `/my-orders`, `/my-sales`, `/wallet`, `/subscription`, `/admin`, `/agent-delivery`.
- Providers principaux : `AuthProvider`, `CountryProvider`, `CartProvider`, `TrustPointsProvider`, `CurrencyManager`.
- Tables Supabase deja utilisees : `profiles`, `products`, `visible_products`, `countries`, `payment_methods`, `commissions`, `commission_rules`, `advertisements`, `orders`, `order_items`, `favorites`, `store_ratings`, `product_ratings`, `store_follows`, `boost_purchases`, `seller_subscriptions`, `payout_requests`, `whatsapp_logs`.
- Statuts produit observes : `active`, `boosted`, `sold`, `validated`, `pending`, `epuise`, `rejected` cote dashboard.
- Statuts commande observes : `pending_whatsapp`, `confirmed_by_customer_service`, `assigned_to_delivery`, `picked_up`, `en_route`, `delivered_by_rider`, `completed`, `cancelled`, avec anciens statuts SQL `pending`, `shipped`, `delivered`.
- Auth mobile : numero WhatsApp + mot de passe, transforme en email interne `{digits}@nikey.app`, puis Supabase Auth.
- Panier mobile : multi-vendeurs, persiste localement. La web app reprend cette logique via `localStorage`.
- Regle metier centrale : aucun numero vendeur ni bouton contact vendeur public. Le checkout ouvre uniquement le WhatsApp officiel Rivendy du pays.

## Architecture web

```text
app/                  Routes Next App Router
components/           Layout + composants UI shadcn-like
features/             Modules produit, panier, checkout, profil, vendeur, auth
lib/supabase/         Clients Supabase browser/server anon
lib/utils/            Formatage, devise, ids commande, helpers
services/             Lectures publiques Supabase + upload image
types/                Types metier Rivendy
supabase/migrations/  Migration proposee pour compatibilite web
```

## Routes creees

- `/` : feed social-commerce avec pays, recherche, categories, stories, pubs, produits boostes et recents.
- `/products/[id]` : detail produit, galerie, prix/devise, vendeur, badges, panier, commande via Rivendy.
- `/store/[sellerId]` : boutique vendeur sans telephone ni WhatsApp vendeur.
- `/auth/login` et `/auth/signup` : Supabase Auth avec email synthetique depuis le numero WhatsApp.
- `/sell` : publication produit avec upload multiple, capture camera navigateur, compression JPEG, insert `products.status = pending`.
- `/cart` : panier multi-vendeurs localStorage.
- `/checkout` : creation de commandes Supabase, une commande par vendeur si panier multi-vendeurs, puis WhatsApp officiel Rivendy.
- `/profile` : profil, historique commandes, favoris, produits publies, trust points calcules depuis les avis.
- `/favorites` : favoris utilisateur.
- `/seller` : espace vendeur web, produits, commandes, gains, demandes boost/certification/retrait.
- `/seller/products/[id]/edit` : modification produit vendeur.

## Variables d'environnement

Copier `.env.local.example` vers `.env.local` si necessaire.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_RIVENDY_WHATSAPP_FALLBACK=+25377145306
```

La cle service role n'est pas utilisee par cette web app publique.

## Regles metier implementees

- Aucun telephone vendeur n'est affiche sur les pages publiques.
- Aucun bouton "contacter le vendeur" n'existe.
- Les achats passent par `/checkout`, creent `orders` + `order_items`, puis ouvrent le WhatsApp officiel Rivendy du pays.
- Les produits publies depuis le web sont en `pending` et attendent la validation admin.
- Les boosts et certifications sont crees en `pending` et restent a valider dans le dashboard.
- Les publicites sont lues depuis `advertisements`; le web tente `web_home_banner`, `web_feed_inline`, `web_category_banner` avec fallback mobile.

## Migration recommandee

Executer si la base n'a pas encore les contraintes web/dashboard recentes :

```text
supabase/migrations/20260509_rivendy_web_compat.sql
```

Elle ajoute les positions publicitaires web, le statut produit `rejected`, les statuts commande du dashboard, `order_items.product_image_url`, et rend les demandes de retrait vendeur compatibles avec l'app/web.

## Lancer

```bash
npm install
npm run dev
```

Puis ouvrir `http://localhost:3000`.
