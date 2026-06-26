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
