@MEMORY.md

---

# Pièges de ce dépôt — à lire avant d'écrire

## 1. Ce site doit rester en parité avec l'app Flutter

`rivendy_web` n'est pas un produit autonome : c'est la version web d'une
application mobile existante (`../rivendy_app`), et les deux tapent dans **le
même Supabase**. Toute logique métier ajoutée ici doit exister à l'identique
côté app, sinon un acheteur obtient un prix ou un comportement différent selon
le canal.

Cas déjà rencontré : un acheteur comorien aurait payé 500 à 3 000 KMF de
livraison depuis l'app et **0** depuis le web, pour le même produit.

**Avant d'implémenter une règle métier ici**, vérifier son équivalent dans
`../rivendy_app/lib/` et lire `../rivendy_app/PROTECTED_ZONES.md`.

## 2. Ne JAMAIS utiliser un libellé d'affichage comme clé de recherche

`categoryLabel()` (`lib/utils/format.ts`) renvoie des libellés d'**interface** :
« Artisanat local », « Supermarché ». La base stocke « Artisanat »,
« Alimentation ». Les réutiliser dans un `.eq()` ne remonte aucune ligne — et
échoue **silencieusement**, en retombant sur une valeur par défaut.

Les correspondances destinées à la base vivent dans
`lib/utils/commission.ts` (`COMMISSION_CATEGORY_LABELS`) et
`lib/utils/delivery-location.ts`.

⚠️ `commission_rules.category` contient des **libellés accentués**
(« Électronique », « Bébé & Enfants »). Les clés techniques camelCase ont été
supprimées de cette table le 2026-07-05 : les utiliser ne renvoie rien.

## 3. Grille de commission — 4 sources à modifier ensemble

`lib/utils/commission.ts` → `REFERENCE_GRID` n'est qu'**une** des quatre copies
de la grille. Modifier un taux ici seulement crée une divergence invisible entre
le web, l'app et le dashboard. Voir `../rivendy_app/PROTECTED_ZONES.md` §1.4.

**Invariant :** `price = seller_price + commission_amount`. La commission
s'AJOUTE au prix vendeur, elle ne s'en déduit jamais.

## 4. Livraison — bascule par marché

Le parcours Région→Localité→Quartier ne s'active **que pour `KM`**
(`isSupportedMarket()` dans `lib/utils/delivery-location.ts`). Les 15 autres
marchés conservent le champ texte libre historique, car leurs zones ne sont pas
en base. Ajouter un marché suppose d'abord de seeder ses régions/localités.

`normalizeLocationName()` est le **miroir exact** de la version Dart et de la
fonction SQL `normalize_location_name()`. Toute divergence rend des localités
introuvables à la recherche.

## 5. Variables d'environnement Vercel

`lib/supabase/client.ts` **lève une exception au build** si
`NEXT_PUBLIC_SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY` manquent. C'est
volontaire — mieux vaut un build rouge qu'un site déployé silencieusement cassé.

⚠️ Ces variables doivent être définies pour **Production ET Preview**. Une
variable définie pour Production seule fait échouer tous les déploiements de
Pull Request (rencontré le 2026-07-26).

`NEXT_PUBLIC_*` est inlinée **au build** : changer une valeur exige un
redéploiement, pas seulement un redémarrage.

## 6. Limite de taille Vercel

Vercel rejette toute requête dont le corps dépasse **4,5 Mo**, avant même
d'atteindre la route (`413 Request Entity Too Large`). Compresser les images
côté navigateur (canvas JPEG) avant tout envoi à `/api/upload`.

---

## Vérifications avant de livrer

`npx tsc --noEmit` → **0 erreur** (obligatoire)
`npm run lint` → ~54 problèmes = niveau de référence. Comparer à l'existant, ne
pas viser 0 (dette de typage `as any` assumée).

**Ne pas lancer `npm run build`** sans demande explicite du propriétaire.

⚠️ `npm run build` modifie `next-env.d.ts` (chemin de types dev → prod). C'est un
artefact, ne pas le commiter.
