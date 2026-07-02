import type { Product } from "@/types/rivendy";

/** Libellé du filtre "tout afficher" (pas de filtrage par rayon). */
export const PHARMACY_FILTER_ALL = "Tous";

/**
 * Rayons produits (= valeurs possibles de `rayon`), dans l'ordre maquette.
 * Le filtre de l'onglet garde les pharmacies ayant AU MOINS un produit
 * du rayon sélectionné. Miroir de kPharmacyRayons côté Flutter.
 */
export const PHARMACY_RAYONS = [
  "Médicaments",
  "Bébé",
  "Hygiène",
  "Bien-être",
  "Premiers soins",
  "Parapharmacie",
  "Matériel",
] as const;

/** Libellés des filtres de l'onglet Pharmacie, dans l'ordre d'affichage. */
export const PHARMACY_FILTERS = [
  PHARMACY_FILTER_ALL,
  ...PHARMACY_RAYONS,
] as const;

/** Vue agrégée d'une pharmacie (= un vendeur) pour l'onglet Pharmacie. */
export interface PharmacyGroup {
  sellerId: string;
  sellerName: string;
  logoUrl: string; // avatar du vendeur ("" → icône de repli)
  coverUrl: string; // 1ʳᵉ photo de produit ("" → fond de repli)
  pharmacyType: string; // "" si aucun produit ne le renseigne
  openingHours: string; // "" si non renseigné (ex: "08:00 - 22:00")
  deliveryZone: string; // "" si non renseignée
  productCount: number;
  isVerified: boolean;
  hasDelivery: boolean;
  hasPrescriptionProducts: boolean; // au moins un produit sous ordonnance
  rayons: string[]; // rayons produits présents dans le catalogue
}

/** Lecture tolérante d'un attribut extra_attributes (→ string trimée). */
function attr(p: Product, key: string): string {
  const v = p.extra_attributes?.[key];
  return v == null ? "" : String(v).trim();
}

/**
 * Lecture tolérante d'un attribut booléen extra_attributes : vrai si la
 * valeur est "true"/"oui"/"1"/"yes" (trim + lowercase) ; sinon faux.
 * Miroir du helper Dart _boolAttr.
 */
function boolAttr(p: Product, key: string): boolean {
  const v = p.extra_attributes?.[key];
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "oui" || s === "1" || s === "yes";
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

/** Type de pharmacie le plus fréquent (mode) parmi `products`. */
export function dominantPharmacyType(products: Product[]): string {
  return dominantAttr(products, "type_pharmacie");
}

/** Première photo de produit non vide du groupe (cover de la carte). */
function firstCover(products: Product[]): string {
  for (const p of products) {
    if (p.photos?.[0]) return p.photos[0];
  }
  return "";
}

/** Applique le filtre actif (par rayon produit). */
function matchesFilter(filter: string, rayons: Set<string>): boolean {
  if (filter === PHARMACY_FILTER_ALL) return true;
  return rayons.has(filter);
}

/**
 * Regroupe les produits pharmacie par vendeur et applique `filter`.
 * Préserve l'ordre d'apparition des vendeurs dans `products`.
 */
export function groupPharmacies(
  products: Product[],
  filter: string = PHARMACY_FILTER_ALL,
): PharmacyGroup[] {
  const bySeller = new Map<string, Product[]>();
  const order: string[] = [];
  for (const p of products) {
    const key = p.seller_id ? p.seller_id : (p.seller_name ?? "");
    if (!bySeller.has(key)) order.push(key);
    const list = bySeller.get(key) ?? [];
    list.push(p);
    bySeller.set(key, list);
  }

  const groups: PharmacyGroup[] = [];
  for (const key of order) {
    const list = bySeller.get(key)!;
    const first = list[0];
    const hasDelivery = list.some((p) =>
      attr(p, "livraison").toLowerCase().startsWith("oui"),
    );
    const hasPrescription = list.some((p) => boolAttr(p, "requires_prescription"));
    const rayons = new Set<string>();
    for (const p of list) {
      const r = attr(p, "rayon");
      if (r) rayons.add(r);
    }

    if (!matchesFilter(filter, rayons)) continue;

    groups.push({
      sellerId: first.seller_id,
      sellerName: first.seller_name ?? "",
      logoUrl: first.seller_avatar_url || "",
      coverUrl: firstCover(list),
      pharmacyType: dominantPharmacyType(list),
      openingHours: dominantAttr(list, "horaires_ouverture"),
      deliveryZone: dominantAttr(list, "zone_livraison"),
      productCount: list.length,
      isVerified: Boolean(first.seller_is_certified),
      hasDelivery,
      hasPrescriptionProducts: hasPrescription,
      rayons: [...rayons],
    });
  }
  return groups;
}
