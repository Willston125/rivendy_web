/**
 * Référentiels de publication — miroirs de `sell_screen.dart` (app).
 * Les données métier sont GÉNÉRÉES depuis l'app (voir les fichiers
 * *.generated.ts) ; ce module n'ajoute que les règles de formulaire.
 */
import { PHASE_B_CATEGORIES } from "./phase-b-listings.generated";
import { CONSTRUCTION_SUBCATEGORIES } from "./construction-subcategories.generated";
import type { ConstructionSubcategory, PhaseBCategory, PhaseBListing } from "./types";

export type { ConstructionSubcategory, PhaseBCategory, PhaseBField, PhaseBListing } from "./types";
export { CONSTRUCTION_SUBCATEGORIES };

/** Catégories « Phase B » publiables par un vendeur (`_isPhaseB` de l'app). */
export const PHASE_B_VENDOR_CATEGORY_IDS = ["location", "mariage", "restaurant", "personnels"] as const;

export function isPhaseBCategory(categoryId: string): boolean {
  return (PHASE_B_VENDOR_CATEGORY_IDS as readonly string[]).includes(categoryId);
}

export function phaseBCategoryFor(categoryId: string): PhaseBCategory | null {
  if (!isPhaseBCategory(categoryId)) return null;
  return PHASE_B_CATEGORIES.find((c) => c.categoryKey === categoryId) ?? null;
}

export function findPhaseBListing(typeKey: string | null | undefined): PhaseBListing | null {
  if (!typeKey) return null;
  for (const cat of PHASE_B_CATEGORIES) {
    const found = cat.listings.find((l) => l.typeKey === typeKey);
    if (found) return found;
  }
  return null;
}

/** Catégorie Construction (`_isConstruction` de l'app). */
export const CONSTRUCTION_CATEGORY_ID = "materiauxConstruction";

export function findConstructionSubcategory(key: string | null | undefined): ConstructionSubcategory | null {
  if (!key) return null;
  return CONSTRUCTION_SUBCATEGORIES.find((s) => s.key === key) ?? null;
}

/**
 * Description enrichie d'un article Construction — format EXACT de
 * `_enrichDescriptionWithConstruction` (sell_screen.dart) :
 * « — Détails <sous-catégorie> — » puis une ligne « Libellé: valeur » par champ.
 */
export function constructionDescription(
  base: string,
  sub: ConstructionSubcategory | null,
  values: Record<string, string>,
): string {
  if (!sub) return base;
  const entries = sub.fields
    .map((f) => [f.label, (values[f.key] ?? "").trim()] as const)
    .filter(([, v]) => v.length > 0)
    .map(([label, v]) => `${label}: ${v}`);
  if (entries.length === 0) return base;
  const block = `— Détails ${sub.label} —\n${entries.join("\n")}`;
  return base ? `${base}\n\n${block}` : block;
}

/** Catégories mode : variantes tailles + couleurs (`_isFashion`). */
export const FASHION_CATEGORY_IDS = ["femme", "homme", "bebeEnfants"] as const;

export function isFashionCategory(categoryId: string): boolean {
  return (FASHION_CATEGORY_IDS as readonly string[]).includes(categoryId);
}

/** Tailles proposées à l'acheteur, dans l'ordre (`_kSizeOptions`). */
export const FASHION_SIZE_OPTIONS = [
  "XS", "S", "M", "L", "XL", "XXL",
  "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46",
] as const;

/** États de l'article — mêmes valeurs que l'app (sell_screen.dart). */
export const CONDITION_OPTIONS = [
  "Neuf avec étiquette",
  "Comme neuf",
  "Très bon état",
  "Bon état",
  "État satisfaisant",
] as const;

export const DEFAULT_CONDITION = "Comme neuf";

/** Nombre maximal de photos par annonce (`_maxImages` de l'app). */
export const MAX_PRODUCT_PHOTOS = 3;
