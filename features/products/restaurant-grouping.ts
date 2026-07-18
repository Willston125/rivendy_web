import type { Product } from "@/types/rivendy";

/** Libellé du filtre "tout afficher" (pas de filtrage par type). */
export const RESTAURANT_FILTER_ALL = "Tous";

/** Filtres dérivés (pas un type d'établissement, mais une propriété). */
export const RESTAURANT_FILTER_PROMOS = "Promotions";
export const RESTAURANT_FILTER_DELIVERY = "Livraison";

/** Types d'établissement réels (= valeurs possibles de `type_etablissement`). */
export const RESTAURANT_TYPE_FILTERS = [
  "Fast-food",
  "Restaurant",
  "Pâtisserie",
  "Boissons",
  "Grillade",
  "Café",
] as const;

/** Libellés des filtres de l'onglet Restaurant, dans l'ordre d'affichage. */
export const RESTAURANT_FILTERS = [
  RESTAURANT_FILTER_ALL,
  ...RESTAURANT_TYPE_FILTERS,
  RESTAURANT_FILTER_PROMOS,
  RESTAURANT_FILTER_DELIVERY,
] as const;

/** Vue agrégée d'un restaurant (= un vendeur) pour l'onglet Restaurant. */
export interface RestaurantGroup {
  sellerId: string;
  sellerName: string;
  logoUrl: string; // avatar du vendeur ("" → icône de repli)
  coverUrl: string; // 1ʳᵉ photo de plat ("" → fond de repli)
  etablissementType: string; // "" si aucun produit ne le renseigne
  cuisine: string; // "" si absent
  openingHours: string; // "" si non renseigné (ex: "08:00 - 22:00")
  deliveryZone: string; // "" si non renseignée
  prepTime: string; // "" si absent (ex: "15 à 30 min")
  productCount: number;
  isVerified: boolean;
  hasDelivery: boolean;
  hasPromo: boolean; // au moins un plat boosté
  /** Titres des plats (ordre d'apparition) — recherche + chips spécialités. */
  dishTitles: string[];
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
 * Indique si un restaurant est ouvert maintenant à partir de la plage
 * `horaires_ouverture` (ex: "08:00 - 22:00", "8h - 22h", "18:00 - 02:00").
 * Gère le passage de minuit. Retourne `false` si la plage est vide ou
 * illisible. `now` injectable pour les tests / le rendu serveur.
 */
export function isRestaurantOpen(hours: string, now: Date = new Date()): boolean {
  if (!hours.trim()) return false;
  const matches = [...hours.matchAll(/(\d{1,2})\s*[:hH]\s*(\d{0,2})/g)];
  if (matches.length < 2) return false;

  const toMinutes = (m: RegExpMatchArray): number => {
    const h = Number.parseInt(m[1] ?? "0", 10) || 0;
    const raw = m[2] ?? "";
    const mm = raw === "" ? 0 : Number.parseInt(raw, 10) || 0;
    return (h % 24) * 60 + (mm % 60);
  };

  const open = toMinutes(matches[0]);
  const close = toMinutes(matches[1]);
  const cur = now.getHours() * 60 + now.getMinutes();

  if (open === close) return true; // ouvert 24h/24
  if (close > open) return cur >= open && cur < close; // même journée
  return cur >= open || cur < close; // passe minuit (ex: 18:00 - 02:00)
}

/** Première photo de plat non vide du groupe (cover de la carte). */
function firstCover(products: Product[]): string {
  for (const p of products) {
    if (p.photos?.[0]) return p.photos[0];
  }
  return "";
}

/** Applique le filtre actif (type réel OU propriété dérivée). */
function matchesFilter(
  filter: string,
  opts: { type: string; hasDelivery: boolean; hasPromo: boolean },
): boolean {
  if (filter === RESTAURANT_FILTER_ALL) return true;
  if (filter === RESTAURANT_FILTER_PROMOS) return opts.hasPromo;
  if (filter === RESTAURANT_FILTER_DELIVERY) return opts.hasDelivery;
  return opts.type === filter; // filtre = type d'établissement
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
    const hasDelivery = list.some((p) =>
      attr(p, "livraison").toLowerCase().startsWith("oui"),
    );
    const hasPromo = list.some((p) => p.status === "boosted");

    if (!matchesFilter(filter, { type, hasDelivery, hasPromo })) continue;

    groups.push({
      sellerId: first.seller_id,
      sellerName: first.seller_name ?? "",
      logoUrl: first.seller_avatar_url || "",
      coverUrl: firstCover(list),
      etablissementType: type,
      cuisine: dominantAttr(list, "type_cuisine"),
      openingHours: dominantAttr(list, "horaires_ouverture"),
      deliveryZone: dominantAttr(list, "zone_livraison"),
      prepTime: dominantAttr(list, "temps_preparation"),
      productCount: list.length,
      isVerified: Boolean(first.seller_is_certified),
      hasDelivery,
      hasPromo,
      dishTitles: list.map((p) => p.title.trim()).filter(Boolean),
    });
  }
  return groups;
}

/** Les 3 premières spécialités à afficher sur la carte. */
export function topDishes(group: RestaurantGroup): string[] {
  return group.dishTitles.slice(0, 3);
}

/** Filtre par recherche : nom d'établissement OU titre de plat. */
export function filterRestaurantGroupsByQuery(
  groups: RestaurantGroup[],
  query: string,
): RestaurantGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups.filter(
    (g) =>
      g.sellerName.toLowerCase().includes(q) ||
      g.dishTitles.some((t) => t.toLowerCase().includes(q)),
  );
}
