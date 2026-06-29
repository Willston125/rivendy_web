import type { Product } from "@/types/rivendy";

/** Filtre "tout afficher". */
export const LOCATION_FILTER_ALL = "Tous";

/** Catégorie Location (regroupe 1..N types de fiches). */
export interface LocationCategory {
  id: string;
  label: string;
  typeKeys: string[];
}

/** Catégories des chips, dans l'ordre d'affichage. */
export const LOCATION_CATEGORIES: LocationCategory[] = [
  { id: "appartements", label: "Appartements", typeKeys: ["location_appartement", "location_studio"] },
  { id: "voitures", label: "Voitures", typeKeys: ["location_voiture", "location_moto", "vente_voiture"] },
  { id: "bureaux", label: "Bureaux", typeKeys: ["location_bureau"] },
  { id: "vacances", label: "Vacances", typeKeys: ["location_vacances"] },
  { id: "evenementiel", label: "Événementiel", typeKeys: ["location_salle", "location_evenementiel"] },
  { id: "materiel", label: "Matériel", typeKeys: ["location_materiel"] },
];

/** Libellés des filtres ('Tous' + catégories). */
export const LOCATION_FILTERS = [LOCATION_FILTER_ALL, ...LOCATION_CATEGORIES.map((c) => c.label)];

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

/** Filtre les offres selon `filter` ('Tous' ou un id de catégorie). */
export function filterLocationOffers(products: Product[], filter: string): Product[] {
  if (filter === LOCATION_FILTER_ALL) return products;
  const cat = LOCATION_CATEGORIES.find((c) => c.id === filter);
  if (!cat) return products;
  return products.filter((p) => cat.typeKeys.includes(p.subcategory));
}

/** Label de la catégorie d'une offre (badge), "" si inconnue. */
export function locationCategoryLabel(p: Product): string {
  const cat = LOCATION_CATEGORIES.find((c) => c.typeKeys.includes(p.subcategory));
  return cat?.label ?? "";
}

/** Unité de location ('mois'/'nuit'/'événement'/'jour'). */
export function locationPriceUnit(p: Product): string {
  if (attr(p, "prix_mois")) return "mois";
  if (attr(p, "prix_nuit")) return "nuit";
  if (attr(p, "prix_evenement")) return "événement";
  if (attr(p, "prix_jour")) return "jour";
  switch (p.subcategory) {
    case "location_appartement":
    case "location_studio":
    case "location_bureau":
      return "mois";
    case "location_vacances":
      return "nuit";
    case "location_salle":
    case "location_evenementiel":
      return "événement";
    default:
      return "jour";
  }
}

/** Valeur du prix (champ prix_* dédié sinon prix produit). */
export function locationPriceValue(p: Product): number {
  for (const k of ["prix_mois", "prix_nuit", "prix_evenement", "prix_jour"]) {
    const v = attr(p, k).replace(/[^\d.]/g, "");
    const n = Number.parseFloat(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return p.price;
}

/** Localisation de l'offre ("" si inconnue). */
export function locationLocality(p: Product): string {
  return attrAny(p, ["localisation", "zone", "zone_couverture", "ville"]);
}

/** Offre disponible (non louée). */
export function locationIsAvailable(p: Product): boolean {
  return p.status !== "sold";
}

/** Sous-titre véhicule (marque · modèle), "" sinon. */
export function locationSubtitle(p: Product): string {
  return [attr(p, "marque"), attr(p, "modele")].filter(Boolean).join(" ");
}

/** Infos clés (max 3) adaptées au type. */
export function locationKeyInfos(p: Product): string[] {
  const out: string[] = [];
  const chambres = attr(p, "chambres");
  if (chambres) out.push(`${chambres} chambre${chambres === "1" ? "" : "s"}`);
  const salons = attr(p, "salons");
  if (salons) out.push(`${salons} salon${salons === "1" ? "" : "s"}`);
  const surface = attr(p, "surface");
  if (surface) out.push(surface);
  if (attr(p, "meuble").toLowerCase().startsWith("oui")) out.push("Meublé");
  const capacite = attr(p, "capacite");
  if (capacite) out.push(capacite);
  const places = attr(p, "places");
  if (places) out.push(`${places} places`);
  const transmission = attr(p, "transmission");
  if (transmission) out.push(transmission);
  const typeMateriel = attr(p, "type_materiel");
  if (typeMateriel) out.push(typeMateriel);
  const typePrestation = attr(p, "type_prestation");
  if (typePrestation) out.push(typePrestation);
  return out.slice(0, 3);
}
