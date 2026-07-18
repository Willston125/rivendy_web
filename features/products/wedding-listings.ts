// ══════════════════════════════════════════════════════════════════
//  RIVENDY — Logique de l'accueil Mariage (parité app 2026-07-18)
//
//  7 sous-types réels (phase_b_listings.dart côté app) : robe_mariage,
//  decoration_mariage, traiteur_mariage, photographe_mariage,
//  makeup_mariage, salle_mariage, voiture_mariage. Pure → testable.
// ══════════════════════════════════════════════════════════════════

import type { Product } from "@/types/rivendy";

function attr(p: Product, key: string): string {
  const v = p.extra_attributes?.[key];
  return v == null ? "" : String(v).trim();
}

export interface WeddingHomeChip {
  id: string;
  label: string;
  typeKeys: string[]; // subcategory values ; vide pour "tous"
}

export const WEDDING_HOME_CHIPS: WeddingHomeChip[] = [
  { id: "tous", label: "Tous", typeKeys: [] },
  { id: "salles", label: "Salles", typeKeys: ["salle_mariage"] },
  { id: "decoration", label: "Décoration", typeKeys: ["decoration_mariage"] },
  { id: "traiteur", label: "Traiteur", typeKeys: ["traiteur_mariage"] },
  { id: "photo", label: "Photo/Vidéo", typeKeys: ["photographe_mariage"] },
  { id: "makeup", label: "Make-up", typeKeys: ["makeup_mariage"] },
  { id: "tenues", label: "Tenues", typeKeys: ["robe_mariage"] },
  { id: "voitures", label: "Voitures", typeKeys: ["voiture_mariage"] },
];

/** Filtre par chip d'accueil (id). Parité Dart `filterWeddingByChip`. */
export function filterWeddingByChip(products: Product[], chipId: string): Product[] {
  if (!chipId || chipId === "tous") return products;
  const chip = WEDDING_HOME_CHIPS.find((c) => c.id === chipId);
  if (!chip || chip.typeKeys.length === 0) return products;
  return products.filter((p) => chip.typeKeys.includes(p.subcategory ?? ""));
}

/** Recherche live par titre (insensible à la casse). */
export function searchWeddingOffers(products: Product[], query: string): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;
  return products.filter((p) => p.title.toLowerCase().includes(q));
}

/** Chips à afficher : Tous + types réellement présents. */
export function presentWeddingChips(products: Product[]): WeddingHomeChip[] {
  const subs = new Set(products.map((p) => p.subcategory ?? ""));
  return WEDDING_HOME_CHIPS.filter(
    (c) => c.id === "tous" || c.typeKeys.some((k) => subs.has(k)),
  );
}

export interface WeddingPriceInfo {
  amount: string;
  prefix: string;
  suffix: string;
}

/** Prix réel : champ dédié (traiteur/salle/voiture) sinon product.price
 *  préfixé « À partir de » (prestataires sans tarif fixe unique). */
export function weddingPriceInfo(p: Product): WeddingPriceInfo {
  const parPersonne = attr(p, "prix_par_personne");
  if (parPersonne) return { amount: parPersonne, prefix: "", suffix: " / personne" };
  const journee = attr(p, "prix_journee");
  if (journee) return { amount: journee, prefix: "", suffix: " / journée" };
  return { amount: "", prefix: "À partir de ", suffix: "" };
}

/** Caractéristiques réelles (max 3) — parité Dart `weddingFeatures`. */
export function weddingFeatures(p: Product): string[] {
  const out: string[] = [];

  const capacite = attr(p, "capacite");
  if (capacite) out.push(`${capacite} personnes`);

  const capaciteMin = attr(p, "capacite_min");
  if (capaciteMin) out.push(`Min. ${capaciteMin} pers.`);

  if (attr(p, "parking").toLowerCase() === "oui") out.push("Parking");
  if (attr(p, "chauffeur_inclus").toLowerCase() === "oui") out.push("Chauffeur inclus");

  const deco = attr(p, "decoration_incluse").toLowerCase();
  if (deco && deco !== "non") out.push("Déco incluse");

  if (attr(p, "deplacement").toLowerCase() === "oui") out.push("À domicile");

  const equipements = attr(p, "equipements");
  if (equipements) {
    const first = equipements.split(",")[0]?.trim();
    if (first) out.push(first);
  }

  const typeDeco = attr(p, "type_deco");
  if (typeDeco) out.push(typeDeco);

  const typeCuisine = attr(p, "type_cuisine");
  if (typeCuisine) out.push(typeCuisine);

  const typeService = attr(p, "type_service");
  if (typeService) out.push(typeService);

  const taille = attr(p, "taille");
  if (taille) out.push(`Taille ${taille}`);

  const style = attr(p, "style");
  if (style) out.push(style);

  return out.slice(0, 3);
}
