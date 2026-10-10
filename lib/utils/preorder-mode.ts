// ══════════════════════════════════════════════════════════════════
//  Mode de vente « Sur commande » choisi par le vendeur (2026-10-10)
//
//  Un article sur commande n'est pas en stock : il est préparé ou commandé
//  après l'achat. Publié avec product_type 'preorder', il va directement
//  dans l'onglet « Sur commande », avec son délai — jamais à l'accueil : la
//  base force show_in_catalog à false pour un vendeur.
//
//  MIROIR EXACT de rivendy_app/lib/features/products/logic/preorder_mode.dart
//  et de guard_product_insert
//  (rivendy_dashboard/supabase/migrations/20261010_preorder_seller_publish.sql),
//  qui REFUSE un article sur commande hors de ces catégories (22023) et un
//  délai hors de 1 à 90 jours (22003). Les modifier ensemble.
// ══════════════════════════════════════════════════════════════════

import type { CategoryId } from "@/types/rivendy";

/** Catégories « article » : grille de commission par prix sans exonération. */
export const PREORDER_ELIGIBLE_CATEGORY_IDS: readonly CategoryId[] = [
  "femme",
  "homme",
  "bebeEnfants",
  "electronique",
  "maison",
  "beauteParfums",
  "artisanatLocal",
  "materiauxConstruction",
];

export function isPreorderEligible(category: string): boolean {
  return (PREORDER_ELIGIBLE_CATEGORY_IDS as readonly string[]).includes(category);
}

/** Délais proposés — mêmes paliers que l'app et le dashboard. null = « à confirmer ». */
export const PREORDER_DELAY_OPTIONS: ReadonlyArray<{ days: number | null; label: string }> = [
  { days: null, label: "À confirmer" },
  { days: 7, label: "1 semaine" },
  { days: 14, label: "2 semaines" },
  { days: 21, label: "3 semaines" },
  { days: 30, label: "1 mois" },
  { days: 45, label: "6 semaines" },
  { days: 60, label: "2 mois" },
];

/**
 * Colonnes « mode de vente » envoyées à la publication. Le choix « sur
 * commande » n'est retenu que pour une catégorie éligible : un vendeur qui
 * l'a coché puis a changé de catégorie publie en achat direct, au lieu
 * d'essuyer un refus de la base.
 */
export function saleModeFields({
  category,
  preorder,
  deliveryDays = null,
  foodPackage = false,
}: {
  category: string;
  preorder: boolean;
  deliveryDays?: number | null;
  foodPackage?: boolean;
}): { product_type: string; delivery_days?: number | null } {
  if (foodPackage) return { product_type: "food_package" };
  if (preorder && isPreorderEligible(category)) {
    return { product_type: "preorder", delivery_days: deliveryDays };
  }
  return { product_type: "standard" };
}

/**
 * Colonnes « mode de vente » à envoyer à la MODIFICATION — vide si rien ne
 * change. Miroir de saleModeEditFields (app) et de guard_product_privileges
 * (dashboard, 20261010_preorder_seller_edit.sql) :
 * - un article d'un autre type (colis alimentaire…) n'est jamais touché ;
 * - catégorie non éligible : on ne touche à un article sur commande que si sa
 *   catégorie vient de changer (la base refuserait) ; un ancien article
 *   Rivendy sur commande, hors liste, reste tel quel ;
 * - repasser en achat direct efface le délai.
 */
export function saleModeEditFields({
  currentType,
  currentDays,
  initialCategory,
  category,
  preorder,
  deliveryDays,
}: {
  currentType: string;
  currentDays: number | null;
  initialCategory: string;
  category: string;
  preorder: boolean;
  deliveryDays: number | null;
}): { product_type?: string; delivery_days?: number | null } {
  if (currentType !== "standard" && currentType !== "preorder") return {};
  const toDirect = { product_type: "standard", delivery_days: null };
  if (!isPreorderEligible(category)) {
    return currentType === "preorder" && category !== initialCategory ? toDirect : {};
  }
  if (preorder) {
    return currentType === "preorder" && currentDays === deliveryDays
      ? {}
      : { product_type: "preorder", delivery_days: deliveryDays };
  }
  return currentType === "preorder" ? toDirect : {};
}

/**
 * Délai d'une COMMANDE contenant des articles sur commande, ou null s'il n'y
 * en a aucun. Lit le mode figé sur chaque ligne au moment de l'achat
 * (order_items.product_type / delivery_days) : le délai promis, pas celui de
 * l'annonce aujourd'hui. Plusieurs articles : le délai le plus long compte.
 */
export function orderPreorderDelay(
  items: ReadonlyArray<{ product_type?: string | null; delivery_days?: number | null }>,
): { text: string; count: number } | null {
  const preorders = items.filter((i) => i.product_type === "preorder");
  if (preorders.length === 0) return null;
  const known = preorders.map((i) => i.delivery_days).filter((d): d is number => d != null && d > 0);
  return {
    text: preorderDelayText(known.length === preorders.length ? Math.max(...known) : null),
    count: preorders.length,
  };
}

/** Phrase du délai, identique sur la fiche app et site. */
export function preorderDelayText(deliveryDays: number | null | undefined): string {
  return deliveryDays != null && deliveryDays > 0
    ? `Délai estimé : ${deliveryDays} jour${deliveryDays > 1 ? "s" : ""} après confirmation`
    : "Délai confirmé par Rivendy après votre commande";
}
