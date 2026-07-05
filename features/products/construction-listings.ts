import type { Product } from "@/types/rivendy";

/** Filtres dérivés (propriétés, pas des matériaux). */
export const CONSTRUCTION_FILTER_ALL = "Tous";
export const CONSTRUCTION_FILTER_PROMOS = "Promotions";
export const CONSTRUCTION_FILTER_DELIVERY = "Livraison";

/** Matériaux réels — miroir de ConstructionSubcategory.all (app), sans "divers". */
export const CONSTRUCTION_MATERIALS: { key: string; label: string; emoji: string }[] = [
  { key: "ciment_beton", label: "Ciment & béton", emoji: "🧱" },
  { key: "fer_acier", label: "Fer & acier", emoji: "🔩" },
  { key: "bois", label: "Bois", emoji: "🪵" },
  { key: "carrelage", label: "Carrelage", emoji: "🟫" },
  { key: "peinture", label: "Peinture", emoji: "🎨" },
  { key: "plomberie", label: "Plomberie", emoji: "🚰" },
  { key: "electricite", label: "Électricité", emoji: "⚡" },
  { key: "outillage", label: "Outillage", emoji: "🛠️" },
  { key: "sanitaire", label: "Sanitaire", emoji: "🚿" },
  { key: "portes_fenetres", label: "Portes & fenêtres", emoji: "🚪" },
  { key: "toiture", label: "Toiture", emoji: "🏠" },
  { key: "sable_gravier", label: "Sable & gravier", emoji: "🏖️" },
];

export function constructionMaterialLabel(key: string): string {
  return CONSTRUCTION_MATERIALS.find((m) => m.key === key)?.label ?? "";
}

/** Vue agrégée d'une société (= un vendeur) pour l'onglet Construction. */
export interface ConstructionCompany {
  sellerId: string;
  sellerName: string;
  coverUrl: string;
  specialties: string[];
  zone: string;
  productCount: number;
  isVerified: boolean;
  hasDelivery: boolean;
  hasPromo: boolean;
}

function attr(p: Product, key: string): string {
  const v = p.extra_attributes?.[key];
  return v == null ? "" : String(v).trim();
}

function attrAny(p: Product, keys: string[]): string {
  for (const k of keys) {
    const v = attr(p, k);
    if (v) return v;
  }
  return "";
}

function specialties(products: Product[], max = 3): string[] {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const p of products) {
    const key = (p.subcategory ?? "").trim();
    if (!key) continue;
    if (!counts.has(key)) order.push(key);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  order.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
  return order.map(constructionMaterialLabel).filter(Boolean).slice(0, max);
}

function matchesFilter(
  list: Product[],
  filter: string,
  { hasDelivery, hasPromo }: { hasDelivery: boolean; hasPromo: boolean },
): boolean {
  if (filter === CONSTRUCTION_FILTER_ALL) return true;
  if (filter === CONSTRUCTION_FILTER_PROMOS) return hasPromo;
  if (filter === CONSTRUCTION_FILTER_DELIVERY) return hasDelivery;
  return list.some((p) => p.subcategory === filter);
}

/** Regroupe les produits Construction par vendeur et applique `filter`. */
export function groupConstructionCompanies(
  products: Product[],
  filter: string = CONSTRUCTION_FILTER_ALL,
): ConstructionCompany[] {
  const bySeller = new Map<string, Product[]>();
  const order: string[] = [];
  for (const p of products) {
    const key = p.seller_id ? p.seller_id : (p.seller_name ?? "");
    if (!bySeller.has(key)) order.push(key);
    const list = bySeller.get(key) ?? [];
    list.push(p);
    bySeller.set(key, list);
  }

  const companies: ConstructionCompany[] = [];
  for (const key of order) {
    const list = bySeller.get(key)!;
    const first = list[0];
    const hasDelivery = list.some((p) => attr(p, "livraison").toLowerCase().startsWith("oui"));
    const hasPromo = list.some((p) => p.status === "boosted");

    if (!matchesFilter(list, filter, { hasDelivery, hasPromo })) continue;

    let zone = "";
    let cover = "";
    for (const p of list) {
      if (!zone) zone = attrAny(p, ["zone", "localisation", "zone_livraison", "ville"]);
      if (!cover && p.photos?.[0]) cover = p.photos[0];
    }

    companies.push({
      sellerId: first.seller_id,
      sellerName: first.seller_name ?? "",
      coverUrl: cover,
      specialties: specialties(list),
      zone,
      productCount: list.length,
      isVerified: Boolean(first.seller_is_certified),
      hasDelivery,
      hasPromo,
    });
  }
  return companies;
}

/** Prix + unité d'un produit construction (ex: "4 500 FDJ / sac"). */
export function constructionUnit(p: Product): string {
  return attrAny(p, ["unite_vente", "unite", "conditionnement", "poids_sac"]);
}

/** Stock affichable d'un produit construction ('' si absent). */
export function constructionStock(p: Product): string {
  return attrAny(p, ["quantite", "surface"]);
}
