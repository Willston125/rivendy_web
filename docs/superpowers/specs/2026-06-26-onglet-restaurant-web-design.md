# Spec — Onglet Restaurant côté `rivendy_web` (parité avec l'app)

**Date** : 2026-06-26
**App** : `rivendy_web` (Next.js App Router, SSR, Supabase)
**Statut** : conception validée, prête pour plan d'implémentation
**Origine** : portage web de la feature déjà livrée dans `rivendy_app`
(voir `rivendy_app/docs/superpowers/specs/2026-06-26-onglet-restaurant-design.md`).

---

## 1. Contexte & objectif

Côté app Flutter, l'onglet Restaurant présente désormais **l'établissement d'abord** :
liste de restaurants (regroupés par vendeur) + barre de filtres
(`Tous · Fast-food · Restaurant · Pâtisserie · Boissons`), clic → catalogue du
restaurant. Un champ `type_etablissement` est écrit dans `extra_attributes`.

**Objectif** : porter cette présentation sur le web pour la **parité app↔web**, en
respectant les conventions web existantes (SSR via `searchParams`, charte `#009688`,
composants existants).

**Point partagé déjà acquis** : la donnée `type_etablissement` (dans
`extra_attributes`) est commune via Supabase — dès qu'un vendeur publie via l'app,
le web peut la lire. Aucune migration.

## 2. Réalités techniques (état du code web)

- La home (`app/page.tsx`) est un composant serveur. Toute la navigation/filtre passe
  par `searchParams` (`category`, `subcategory`, `q`, `sort`, `priceMin/Max`).
- Les catégories sont déclarées dans `types/rivendy.ts` (`CATEGORIES`), dont
  `{ id: "restaurant", label: "Restaurant" }`. `SUBCATEGORIES` n'a **pas** d'entrée
  `restaurant`.
- **Précédent direct** : la catégorie `alimentation` a déjà une section spéciale
  (« Supermarché ») qui remplace la grille standard
  ([page.tsx:257](../../../app/page.tsx)), gardée par `isAlimentation`, et la section
  standard est gardée par `{!isAlimentation && (...)}` ([page.tsx:307](../../../app/page.tsx)).
  On calque le même mécanisme pour `restaurant`.
- Le catalogue vendeur existe déjà : route `app/store/[sellerId]`. C'est la
  destination du clic sur un restaurant.
- **Maillon manquant** : l'interface `Product` ([types/rivendy.ts:107](../../../types/rivendy.ts))
  et le mapping `normalizeProduct` ([public-data.ts:20](../../../services/public-data.ts))
  **n'exposent pas** `extra_attributes` ni `business_type`, alors que la requête
  `select("*")` les ramène déjà de la base. Il faut les ajouter au mapping.
- Les produits restaurant arrivent déjà filtrés par catégorie : `getProducts` applique
  `query.eq("category", category)` ([public-data.ts:209](../../../services/public-data.ts)).

## 3. Contraintes non négociables (charte & règles métier)

- **Charte web** : couleur primaire `#009688` (et `#007168` foncé) ; réutiliser les
  styles de chips déjà en place (catégories/sous-catégories), cartes arrondies,
  `font-black`. Aucune autre couleur d'accent.
- **Aucun contact direct vendeur** : la carte restaurant ne propose qu'un lien vers
  `/store/[sellerId]`. Pas de téléphone / WhatsApp.
- **SSR-first** : le filtre est un `searchParam` (`resType`), pas du state client —
  partageable, indexable, cohérent avec le reste de la page.
- **Zéro migration SQL.** Tout repose sur `extra_attributes` déjà peuplé par l'app.
- **Ne pas toucher** aux autres modifications non commitées du dépôt (WIP utilisateur)
  ni aux autres catégories/onglets.

## 4. Conception détaillée

### Bloc ① — Donnée : exposer `extra_attributes` et `business_type`

Fichiers : `types/rivendy.ts`, `services/public-data.ts`.

1. Ajouter à l'interface `Product` :
   ```ts
   extra_attributes: Record<string, string>;
   business_type: string;
   ```
2. Dans `normalizeProduct`, mapper depuis la row (la requête sélectionne déjà `*`) :
   ```ts
   business_type: String(row.business_type ?? "boutique"),
   extra_attributes: normalizeAttrs(row.extra_attributes),
   ```
   avec un helper local `normalizeAttrs(raw): Record<string, string>` qui tolère
   `null` / objet : retourne `{}` si absent, sinon convertit chaque valeur en `String`.

### Bloc ② — Logique pure (port TS de `restaurant_grouping.dart`)

Fichier créé : `features/products/restaurant-grouping.ts`.

Exporte (équivalents stricts de la version Dart) :
- `const RESTAURANT_FILTER_ALL = "Tous";`
- `const RESTAURANT_FILTERS = ["Tous", "Fast-food", "Restaurant", "Pâtisserie", "Boissons"];`
- `interface RestaurantGroup { sellerId; sellerName; logoUrl; etablissementType; cuisine; productCount; isVerified; hasDelivery; }`
- `dominantAttr(products, key): string` — valeur la plus fréquente (mode) d'un attribut
  `extra_attributes[key]` parmi une liste ; égalité → premier rencontré ; `""` si aucune.
- `groupRestaurants(products, filter = RESTAURANT_FILTER_ALL): RestaurantGroup[]` —
  regroupe par `seller_id` (repli sur `seller_name` si vide), préserve l'ordre
  d'apparition, dérive `etablissementType` et `cuisine` via `dominantAttr`, calcule
  `hasDelivery` (au moins un produit dont `livraison` commence par « oui »), résout
  `sellerName` (« Rivendy » si applicable — cf. note ci-dessous), `logoUrl`
  (`seller_avatar_url` sinon 1ère photo du 1er produit), `isVerified`
  (`seller_is_certified`).

> Note « Rivendy » : la version Flutter utilise `showAsRivendy`. Le `Product` web ne
> porte pas ce champ. Pour le port, on n'affiche **pas** d'alias « Rivendy » (on garde
> `seller_name`) — hors périmètre, à harmoniser plus tard si besoin. C'est une
> divergence assumée et documentée, sans impact fonctionnel sur le filtrage.

### Bloc ③ — Filtre `resType` (searchParam SSR)

Fichier : `app/page.tsx`.

1. Étendre `HomeSearchParams` avec `resType?: string;` et lire
   `const resType = params.resType;`.
2. Définir `const isRestaurant = category === "restaurant";`.
3. Quand `isRestaurant`, afficher une **barre de chips** (au même emplacement que la
   barre de sous-catégories, dont le style est repris) : un `<Link>` par entrée de
   `RESTAURANT_FILTERS` vers
   `/?country=${countryId}&category=restaurant${value === "Tous" ? "" : "&resType=" + encodeURIComponent(value)}`,
   le chip actif déterminé par `(!resType && value === "Tous") || resType === value`.
   Styles identiques aux chips de sous-catégories (actif `#1A1A1A`/`#009688` selon le
   pattern retenu pour rester cohérent ; couleur d'accent `#009688`).

### Bloc ④ — Section établissements + carte

Fichiers : `app/page.tsx`, `features/products/restaurant-establishment-card.tsx` (créé).

1. Dans `page.tsx`, calculer
   `const restaurantGroups = isRestaurant ? groupRestaurants(products, resType ?? RESTAURANT_FILTER_ALL) : [];`
   (on regroupe **tous** les produits restaurant, boostés inclus — cf. §7 — pour ne pas
   masquer un restaurant dont tous les plats seraient boostés).
2. Ajouter une section `isRestaurant` calquée sur la section `isAlimentation` : titre
   « Restaurants » + compteur, puis la liste de `RestaurantEstablishmentCard`.
   État vide réutilisé/inline si `restaurantGroups.length === 0`.
3. **Garder la section standard hors restaurant** : changer le garde
   `{!isAlimentation && (...)}` en `{!isAlimentation && !isRestaurant && (...)}`.
4. **Masquer la section « Produits boostés » générique quand `isRestaurant`** (sinon
   doublon plats individuels / établissements) : ajouter `!isRestaurant` à son garde.
5. Supprimer le rendu de `CatalogToolbar` (tri/prix) quand `isRestaurant` (il trie des
   plats, pas des établissements) : le garde `(category || q)` devient
   `((category || q) && !isRestaurant)`.
6. `RestaurantEstablishmentCard` (composant serveur, props : `group: RestaurantGroup`,
   `currencySymbol?`) : `<Link href={`/store/${group.sellerId}`}>` ; logo
   (`<img>` avec repli icône), nom + ✓ certifié, badge type d'établissement, chip
   cuisine, chip « Livraison » si `hasDelivery`, libellé « N plats », chevron. 100 %
   charte `#009688`/`#007168` + neutres déjà utilisés. Aucun contact direct.

## 5. Flux utilisateur (web)

```
/?category=restaurant
  → chips [Tous · Fast-food · Restaurant · Pâtisserie · Boissons] (liens resType)
  → section "Restaurants" : liste de RestaurantEstablishmentCard (1 / vendeur, filtrée)
       └─ clic → /store/{sellerId}  (catalogue du restaurant — déjà existant)
```

## 6. Fichiers touchés

| Fichier | Nature |
|---|---|
| `types/rivendy.ts` | + `extra_attributes`, `business_type` dans `Product` |
| `services/public-data.ts` | mapping des 2 champs dans `normalizeProduct` (+ helper `normalizeAttrs`) |
| `features/products/restaurant-grouping.ts` (créé) | logique pure : types, constantes, `dominantAttr`, `groupRestaurants` |
| `features/products/restaurant-establishment-card.tsx` (créé) | carte établissement |
| `app/page.tsx` | `resType`, `isRestaurant`, barre de filtres, section, gardes ajustés |

- **Zéro migration SQL.** **Zéro nouvelle route** (catalogue = `store/[sellerId]`).
- Ne pas committer le WIP non lié déjà présent dans le dépôt.

## 7. Cas limites & règles

- **Produit sans `type_etablissement`** → établissement classé « Tous » uniquement.
- **Types hétérogènes** dans un même restaurant → type/ cuisine = valeur la plus
  fréquente (mode), égalité = premier rencontré.
- **`seller_id` vide** → repli sur `seller_name` pour le regroupement ; le lien
  `/store/` n'est pas rendu (ou rendu non cliquable) si `sellerId` vide.
- **Liste filtrée vide** → message d'état vide inline (« Aucun restaurant… »).
- **Produits boostés** : pour la v1, la liste établissements est construite à partir de
  `recent` (non-boostés). Décision : on construit les groupes à partir de **tous** les
  produits restaurant (`products`), pas seulement `recent`, pour ne pas masquer un
  restaurant dont tous les plats seraient boostés — la section « Produits boostés »
  générique est masquée quand `isRestaurant` (sinon doublon plats/établissements).

## 8. Hors périmètre (v2 éventuelle)

- Présentation « menu » du catalogue dans `store/[sellerId]`.
- Tri des restaurants (note, popularité), pagination par établissement.
- Alias « Rivendy » (champ `show_as_rivendy` non mappé web).
- Bannière pub catégorie restaurant (`web_category_banner`).

## 9. Vérification (à l'implémentation)

- `npx tsc --noEmit` → zéro erreur de type (pas de build complet sans demande).
- `npx eslint` sur les fichiers touchés → propre.
- Vérifs manuelles (dev server sur demande) : `/?category=restaurant` affiche des
  établissements ; les chips `resType` filtrent ; clic ouvre `/store/{sellerId}` ;
  un plat publié avec `type_etablissement` apparaît sous le bon filtre ; un plat sans
  valeur reste sous « Tous » ; les autres catégories inchangées.
