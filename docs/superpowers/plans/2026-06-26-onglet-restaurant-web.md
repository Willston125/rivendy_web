# Onglet Restaurant Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Porter l'onglet Restaurant « établissement d'abord » sur `rivendy_web` : liste de restaurants regroupés par vendeur, filtres par type d'établissement en searchParam SSR, clic → catalogue `/store/[sellerId]`.

**Architecture:** On expose `extra_attributes`/`business_type` dans le `Product` web, on porte la logique de regroupement Flutter en TypeScript pur, et on ajoute une section spéciale `isRestaurant` dans `app/page.tsx` (calquée sur la section `alimentation` existante) avec une barre de filtres `resType` (searchParam) et une carte établissement dédiée.

**Tech Stack:** Next.js (App Router, composants serveur), TypeScript, Tailwind, Supabase. Vérification : `npm run typecheck` (tsc --noEmit) + `npm run lint` (eslint). Le projet n'a pas de framework de test unitaire ; on ne l'introduit pas (convention projet). La logique portée est une traduction directe de `restaurant_grouping.dart`, déjà couvert par 13 tests côté app.

**Référence spec :** `docs/superpowers/specs/2026-06-26-onglet-restaurant-web-design.md`

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `types/rivendy.ts` | + champs `extra_attributes`, `business_type` dans l'interface `Product` |
| `services/public-data.ts` | mapping des 2 champs dans `normalizeProduct` (+ helper `normalizeAttrs`) |
| `features/products/restaurant-grouping.ts` (créé) | logique pure : types, constantes, `dominantAttr`, `groupRestaurants` |
| `features/products/restaurant-establishment-card.tsx` (créé) | carte établissement (composant serveur) |
| `app/page.tsx` | `resType`, `isRestaurant`, barre de filtres, section établissements, gardes ajustés |

Contraintes : zéro migration SQL, zéro nouvelle route, charte `#009688`/`#007168`, aucun contact direct, ne pas committer le WIP non lié déjà présent dans le dépôt.

---

## Task 1 : Exposer `extra_attributes` et `business_type` sur le `Product` web

**Files:**
- Modify: `types/rivendy.ts` (interface `Product`, après la ligne `seller_country_id?...`)
- Modify: `services/public-data.ts` (fonction `normalizeProduct` + nouveau helper)

- [ ] **Step 1 : Ajouter les 2 champs à l'interface `Product`**

Dans `types/rivendy.ts`, à l'intérieur de `export interface Product { ... }`, ajouter juste après la ligne `seller_country_id?: string | null;` (dernier champ avant l'accolade fermante) :

```ts
  business_type: string;
  extra_attributes: Record<string, string>;
```

- [ ] **Step 2 : Ajouter le helper `normalizeAttrs` dans `public-data.ts`**

Dans `services/public-data.ts`, ajouter ce helper juste après la fonction `toNumber` (vers la ligne 18, avant `normalizeProduct`) :

```ts
function normalizeAttrs(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value == null) continue;
    out[key] = String(value).trim();
  }
  return out;
}
```

- [ ] **Step 3 : Mapper les 2 champs dans `normalizeProduct`**

Toujours dans `services/public-data.ts`, dans le `return { ... }` de `normalizeProduct`, ajouter juste après la propriété `seller_country_id: ...,` (dernière du retour) :

```ts
    business_type: String(row.business_type ?? "boutique"),
    extra_attributes: normalizeAttrs(row.extra_attributes),
```

(La requête utilise déjà `.select("*")`, donc `row.business_type` et `row.extra_attributes` sont présents.)

- [ ] **Step 4 : Vérifier le typage**

Run: `cd /c/Users/hp/Documents/Ecommerce/rivendy_web && npm run typecheck`
Expected: pas d'erreur (exit 0, aucune sortie d'erreur TS).

- [ ] **Step 5 : Commit**

```bash
git add types/rivendy.ts services/public-data.ts
git commit -m "feat(restaurant-web): expose extra_attributes et business_type sur Product"
```

---

## Task 2 : Logique pure de regroupement (port TS de `restaurant_grouping.dart`)

**Files:**
- Create: `features/products/restaurant-grouping.ts`

- [ ] **Step 1 : Créer le fichier de logique**

Créer `features/products/restaurant-grouping.ts` avec EXACTEMENT ce contenu :

```ts
// ══════════════════════════════════════════════════════════════════
//  RIVENDY WEB — Logique d'agrégation de l'onglet Restaurant
//
//  Un "restaurant" = un vendeur (business_type = 'restaurant').
//  Regroupe les produits restaurant par vendeur, dérive le type
//  d'établissement (valeur la plus fréquente) et applique le filtre.
//  Port TS de rivendy_app/lib/features/products/logic/restaurant_grouping.dart.
// ══════════════════════════════════════════════════════════════════

import type { Product } from "@/types/rivendy";

/** Libellé du filtre "tout afficher" (pas de filtrage par type). */
export const RESTAURANT_FILTER_ALL = "Tous";

/** Libellés des filtres de l'onglet Restaurant, dans l'ordre d'affichage. */
export const RESTAURANT_FILTERS = [
  RESTAURANT_FILTER_ALL,
  "Fast-food",
  "Restaurant",
  "Pâtisserie",
  "Boissons",
] as const;

/** Vue agrégée d'un restaurant (= un vendeur) pour l'onglet Restaurant. */
export interface RestaurantGroup {
  sellerId: string;
  sellerName: string;
  logoUrl: string;
  etablissementType: string; // "" si aucun produit ne le renseigne
  cuisine: string; // "" si absent
  productCount: number;
  isVerified: boolean;
  hasDelivery: boolean;
}

/** Lecture tolérante d'un attribut extra_attributes (→ string trimée). */
function attr(p: Product, key: string): string {
  const v = p.extra_attributes?.[key];
  return v == null ? "" : String(v).trim();
}

/**
 * Valeur la plus fréquente (mode) de l'attribut `key` parmi `products`.
 * En cas d'égalité, la première rencontrée dans l'ordre de la liste.
 * Retourne "" si aucun produit ne porte la valeur.
 */
export function dominantAttr(products: Product[], key: string): string {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const p of products) {
    const t = attr(p, key);
    if (!t) continue;
    if (!counts.has(t)) order.push(t);
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const t of order) {
    const c = counts.get(t)!;
    if (c > bestCount) {
      best = t;
      bestCount = c;
    }
  }
  return best;
}

/**
 * Regroupe les produits restaurant par vendeur et applique `filter`.
 * Préserve l'ordre d'apparition des vendeurs dans `products`.
 */
export function groupRestaurants(
  products: Product[],
  filter: string = RESTAURANT_FILTER_ALL,
): RestaurantGroup[] {
  const bySeller = new Map<string, Product[]>();
  const order: string[] = [];
  for (const p of products) {
    const key = p.seller_id ? p.seller_id : (p.seller_name ?? "");
    if (!bySeller.has(key)) order.push(key);
    const list = bySeller.get(key) ?? [];
    list.push(p);
    bySeller.set(key, list);
  }

  const groups: RestaurantGroup[] = [];
  for (const key of order) {
    const list = bySeller.get(key)!;
    const first = list[0];
    const type = dominantAttr(list, "type_etablissement");
    if (filter !== RESTAURANT_FILTER_ALL && type !== filter) continue;
    const hasDelivery = list.some((p) =>
      attr(p, "livraison").toLowerCase().startsWith("oui"),
    );
    groups.push({
      sellerId: first.seller_id,
      sellerName: first.seller_name ?? "",
      logoUrl: first.seller_avatar_url || first.photos[0] || "",
      etablissementType: type,
      cuisine: dominantAttr(list, "type_cuisine"),
      productCount: list.length,
      isVerified: Boolean(first.seller_is_certified),
      hasDelivery,
    });
  }
  return groups;
}
```

- [ ] **Step 2 : Vérifier le typage**

Run: `cd /c/Users/hp/Documents/Ecommerce/rivendy_web && npm run typecheck`
Expected: pas d'erreur (exit 0).

- [ ] **Step 3 : Lint du fichier**

Run: `cd /c/Users/hp/Documents/Ecommerce/rivendy_web && npx eslint features/products/restaurant-grouping.ts`
Expected: pas d'erreur.

- [ ] **Step 4 : Commit**

```bash
git add features/products/restaurant-grouping.ts
git commit -m "feat(restaurant-web): logique d'agrégation des restaurants (port TS)"
```

---

## Task 3 : Carte établissement `RestaurantEstablishmentCard`

**Files:**
- Create: `features/products/restaurant-establishment-card.tsx`

- [ ] **Step 1 : Créer le composant**

Créer `features/products/restaurant-establishment-card.tsx` avec EXACTEMENT ce contenu :

```tsx
import Link from "next/link";
import { ChevronRight, Store, Utensils, Bike, BadgeCheck } from "lucide-react";
import type { RestaurantGroup } from "@/features/products/restaurant-grouping";

/**
 * Carte établissement (1 par restaurant) pour l'onglet Restaurant web.
 * Clic → catalogue du restaurant (/store/[sellerId]). Aucun contact direct.
 * Charte Rivendy : #009688 / #007168 + neutres.
 */
export function RestaurantEstablishmentCard({ group }: { group: RestaurantGroup }) {
  const plats = `${group.productCount} ${group.productCount > 1 ? "plats" : "plat"}`;

  const inner = (
    <div className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition hover:shadow-md">
      {/* Logo */}
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#E0F2F1]">
        {group.logoUrl ? (
          <img
            src={group.logoUrl}
            alt={group.sellerName}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#009688]">
            <Utensils className="h-6 w-6" />
          </div>
        )}
      </div>

      {/* Infos */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate text-sm font-black text-[#1A1A1A]">
            {group.sellerName}
          </h3>
          {group.isVerified && <BadgeCheck className="h-4 w-4 shrink-0 text-[#009688]" />}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {group.etablissementType && (
            <span className="rounded-full bg-[#007168] px-2.5 py-1 text-[11px] font-bold text-white">
              {group.etablissementType}
            </span>
          )}
          {group.cuisine && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
              <Utensils className="h-3 w-3" />
              {group.cuisine}
            </span>
          )}
          {group.hasDelivery && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#E0F2F1] px-2.5 py-1 text-[11px] font-bold text-[#009688]">
              <Bike className="h-3 w-3" />
              Livraison
            </span>
          )}
        </div>

        <span className="text-[12px] font-semibold text-[#007168]">{plats}</span>
      </div>

      <ChevronRight className="h-5 w-5 shrink-0 text-[#009688]" />
    </div>
  );

  if (!group.sellerId) {
    return <div className="cursor-default opacity-90">{inner}</div>;
  }

  return (
    <Link href={`/store/${group.sellerId}`} className="block">
      {inner}
    </Link>
  );
}
```

> Avant d'écrire, vérifier rapidement qu'un composant voisin importe bien des icônes depuis `lucide-react` (la home importe déjà `Zap` de `lucide-react`). `Store` est importé pour cohérence éventuelle mais peut être retiré s'il déclenche un warning eslint « unused » — n'importer que les icônes réellement utilisées (`ChevronRight`, `Utensils`, `Bike`, `BadgeCheck`).

- [ ] **Step 2 : Retirer l'import d'icône inutilisé**

`Store` n'est pas utilisé dans le JSX ci-dessus. Retirer `Store,` de la ligne d'import lucide-react pour éviter un échec eslint `no-unused-vars`. Import final :

```tsx
import { ChevronRight, Utensils, Bike, BadgeCheck } from "lucide-react";
```

- [ ] **Step 3 : Vérifier typage + lint**

Run: `cd /c/Users/hp/Documents/Ecommerce/rivendy_web && npm run typecheck && npx eslint features/products/restaurant-establishment-card.tsx`
Expected: pas d'erreur.

- [ ] **Step 4 : Commit**

```bash
git add features/products/restaurant-establishment-card.tsx
git commit -m "feat(restaurant-web): carte établissement RestaurantEstablishmentCard"
```

---

## Task 4 : Câblage de la section Restaurant dans `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`

READ le fichier d'abord pour localiser les ancres exactes (les numéros de ligne auront bougé). Édits ciblés, style existant.

- [ ] **Step 1 : Ajouter les imports**

En haut de `app/page.tsx`, à côté des autres imports `@/features/products/...`, ajouter :

```tsx
import { groupRestaurants, RESTAURANT_FILTERS, RESTAURANT_FILTER_ALL } from "@/features/products/restaurant-grouping";
import { RestaurantEstablishmentCard } from "@/features/products/restaurant-establishment-card";
```

- [ ] **Step 2 : Ajouter `resType` aux searchParams**

Dans le type `HomeSearchParams` (le `Promise<{ ... }>`), ajouter le champ :

```tsx
  resType?: string;
```

Puis, dans le corps de `HomePage`, après la ligne `const subcategory = params.subcategory;`, ajouter :

```tsx
  const resType = params.resType;
```

- [ ] **Step 3 : Déclarer `isRestaurant` et les groupes**

Juste après la ligne `const isAlimentation = category === "alimentation";`, ajouter :

```tsx
  const isRestaurant = category === "restaurant";
  const restaurantGroups = isRestaurant
    ? groupRestaurants(products, resType ?? RESTAURANT_FILTER_ALL)
    : [];
```

- [ ] **Step 4 : Barre de filtres `resType`**

Repérer le bloc des sous-catégories `{category && subcategories.length > 0 && ( ... )}`. Juste APRÈS la fin de ce bloc (`)}`), insérer la barre de filtres restaurant :

```tsx
          {/* ── Filtres Restaurant (type d'établissement) ─────────── */}
          {isRestaurant && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {RESTAURANT_FILTERS.map((value) => {
                const active =
                  (!resType && value === RESTAURANT_FILTER_ALL) || resType === value;
                const href =
                  value === RESTAURANT_FILTER_ALL
                    ? `/?country=${countryId}&category=restaurant`
                    : `/?country=${countryId}&category=restaurant&resType=${encodeURIComponent(value)}`;
                return (
                  <Link
                    key={value}
                    href={href}
                    className={cn(
                      "shrink-0 rounded-full px-4 py-1.5 text-[12px] font-bold transition",
                      active
                        ? "bg-[#009688] text-white shadow-sm shadow-[#009688]/20"
                        : "border border-slate-200 bg-white text-slate-500 hover:border-[#009688]/30 hover:text-[#009688]",
                    )}
                  >
                    {value}
                  </Link>
                );
              })}
            </div>
          )}
```

- [ ] **Step 5 : Ne pas afficher la barre catalogue (tri/prix) pour Restaurant**

Repérer `{(category || q) && (` qui entoure `<CatalogToolbar ... />`. Remplacer la condition par :

```tsx
          {(category || q) && !isRestaurant && (
```

- [ ] **Step 6 : Ne pas afficher la section « Produits boostés » pour Restaurant**

Repérer `{boosted.length > 0 && (`. Remplacer par :

```tsx
          {boosted.length > 0 && !isRestaurant && (
```

- [ ] **Step 7 : Ajouter la section établissements**

Juste AVANT le bloc `{/* ── Section Nouveautés / Résultats (layout standard) ──── */}` (la ligne `{!isAlimentation && (`), insérer la section restaurant :

```tsx
          {/* ── Section Restaurants (établissement d'abord) ───────── */}
          {isRestaurant && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xl">🍽️</span>
                <h2 className="text-[15px] font-black text-slate-900">Restaurants</h2>
                <span className="rounded-full bg-[#E0F2F1] px-2 py-0.5 text-[11px] font-bold text-[#007168]">
                  {restaurantGroups.length} établissement{restaurantGroups.length > 1 ? "s" : ""}
                </span>
              </div>
              {restaurantGroups.length > 0 ? (
                <div className="space-y-3">
                  {restaurantGroups.map((group) => (
                    <RestaurantEstablishmentCard key={group.sellerId || group.sellerName} group={group} />
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-slate-100 bg-white p-6 text-center text-sm font-semibold text-slate-500">
                  Aucun restaurant disponible pour ce filtre.
                </p>
              )}
            </section>
          )}
```

- [ ] **Step 8 : Exclure Restaurant de la section standard**

Repérer `{!isAlimentation && (` (qui ouvre la section « Nouveautés / Résultats »). Remplacer par :

```tsx
          {!isAlimentation && !isRestaurant && (
```

- [ ] **Step 9 : Vérifier typage + lint**

Run: `cd /c/Users/hp/Documents/Ecommerce/rivendy_web && npm run typecheck && npx eslint app/page.tsx`
Expected: pas d'erreur.

- [ ] **Step 10 : Commit**

```bash
git add app/page.tsx
git commit -m "feat(restaurant-web): onglet établissement d'abord + filtres resType (SSR)"
```

---

## Task 5 : QC final & vérification manuelle

**Files:** aucun (vérification).

- [ ] **Step 1 : Typage global**

Run: `cd /c/Users/hp/Documents/Ecommerce/rivendy_web && npm run typecheck`
Expected: exit 0, aucune erreur TS.

- [ ] **Step 2 : Lint des fichiers de la feature**

Run: `cd /c/Users/hp/Documents/Ecommerce/rivendy_web && npx eslint app/page.tsx features/products/restaurant-grouping.ts features/products/restaurant-establishment-card.tsx services/public-data.ts types/rivendy.ts`
Expected: aucune erreur.

- [ ] **Step 3 : Vérification manuelle (lancer le dev server uniquement si l'utilisateur le demande)**

NE PAS lancer `npm run dev` ni `npm run build` sans demande explicite de l'utilisateur (règle projet). Si demandé, checklist sur `/?category=restaurant` :
- La catégorie Restaurant affiche des **cartes établissement** (1 par vendeur), pas une grille de plats.
- Les chips `Tous · Fast-food · Restaurant · Pâtisserie · Boissons` filtrent la liste et l'URL reflète `resType`.
- Un filtre sans résultat affiche le message d'état vide.
- Clic sur un restaurant ouvre `/store/{sellerId}`.
- Les autres catégories (femme, alimentation, etc.) sont inchangées.
- Aucune couleur hors charte ; aucun bouton de contact direct.

- [ ] **Step 4 : Commit éventuel des correctifs QC**

Si des correctifs ont été nécessaires :

```bash
git add -A -- app/page.tsx features/products/ services/public-data.ts types/rivendy.ts
git commit -m "fix(restaurant-web): correctifs QC onglet restaurant"
```

> Important : ne committer QUE les fichiers de la feature. Le dépôt contient déjà des
> modifications WIP non liées (cf. `git status`) — ne pas les inclure.

---

## Auto-revue (couverture spec)

- Spec §4 Bloc ① (data extra_attributes/business_type) → Task 1. ✅
- Spec §4 Bloc ② (logique pure) → Task 2 (`dominantAttr`, `groupRestaurants`, constantes, `RestaurantGroup`). ✅
- Spec §4 Bloc ③ (filtre resType SSR) → Task 4 Steps 2 + 4. ✅
- Spec §4 Bloc ④ (section + carte ; groupes depuis `products` ; CatalogToolbar et boostés masqués ; section standard exclue) → Task 3 + Task 4 Steps 3,5,6,7,8. ✅
- Spec §7 cas limites (sans type → Tous via dominantAttr "" ; mode + tie-break ; sellerId vide → pas de lien ; liste vide → état vide ; boostés inclus) → Task 2 + Task 4 Steps 3,7 + Task 3. ✅
- Spec §9 vérification (tsc, eslint, manuel) → Task 5. ✅
- Cohérence des noms : `groupRestaurants`, `dominantAttr`, `RestaurantGroup`, `RESTAURANT_FILTERS`, `RESTAURANT_FILTER_ALL`, `RestaurantEstablishmentCard`, `resType`, `isRestaurant`, `restaurantGroups`, champs `business_type`/`extra_attributes` — identiques entre toutes les tasks et la spec. ✅
