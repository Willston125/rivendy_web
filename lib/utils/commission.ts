// ═══════════════════════════════════════════════════════════════════════════
// GRILLE DE COMMISSION — référence web
// ═══════════════════════════════════════════════════════════════════════════
// Décision propriétaire 2026-07-25. Doit rester STRICTEMENT identique à :
//   • rivendy_dashboard/supabase/migrations/20260725_commission_grid_16_markets.sql
//   • rivendy_dashboard/lib/commission-grid.ts
//   • rivendy_app/lib/features/checkout/services/commission_service.dart
//
// Contexte (AUDIT_COMMISSIONS_CATEGORIES_2026-07-25.md) :
//
//   • Le formulaire interrogeait `commission_rules` avec la clé technique
//     ('femme'), alors que la migration du 2026-07-05 a supprimé toutes les
//     lignes camelCase de cette table. La requête ne renvoyait donc JAMAIS
//     rien et retombait sur la table legacy `commissions` (§C3).
//   • Le repli utilisait `categoryLabel()`, une fonction d'AFFICHAGE dont les
//     libellés ne correspondent pas à ceux stockés en base :
//       'artisanatLocal' → « Artisanat local »  ≠  « Artisanat »
//       'alimentation'   → « Supermarché »      ≠  « Alimentation »
//     Ces deux catégories ne trouvaient donc aucune ligne, même en repli (§C5).
//   • L'aperçu affichait « ~7 % » codé en dur pour toutes les catégories.
//
// ⚠️ Ne JAMAIS réutiliser categoryLabel() pour une recherche en base : c'est
//    un libellé d'interface, il peut changer sans que la base change.
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from "@/lib/supabase/client";

/// Clé technique (products.category) → libellé stocké dans commission_rules.
/// Les accents sont significatifs.
export const COMMISSION_CATEGORY_LABELS: Record<string, string> = {
  femme: "Femme",
  homme: "Homme",
  bebeEnfants: "Bébé & Enfants",
  electronique: "Électronique",
  maison: "Maison",
  beauteParfums: "Beauté & Parfums",
  artisanatLocal: "Artisanat",
  materiauxConstruction: "Construction",
  alimentation: "Alimentation",
  location: "Location",
  mariage: "Mariage",
  restaurant: "Restaurant",
  personnels: "Personnels",
  hotel: "Hôtels",
  pharmacie: "Pharmacie",
};

/// Taux de référence par libellé, en fraction décimale (0.07 = 7 %).
export const REFERENCE_GRID: Record<string, number> = {
  // Vente classique — taux général
  Femme: 0.07,
  Homme: 0.07,
  "Bébé & Enfants": 0.07,
  Maison: 0.07,
  "Beauté & Parfums": 0.07,
  Électronique: 0.07,
  Mariage: 0.07,
  // Taux réduit — soutien aux artisans locaux
  Artisanat: 0.05,
  // Taux majoré — panier élevé
  Construction: 0.1,
  // 0 % — marge grossiste déjà incluse dans le prix négocié
  Alimentation: 0,
  // 0 % — modèle abonnement, jamais de commission sur les ventes
  Pharmacie: 0,
  // 0 % — pages vitrines, modèle abonnement (décision 2026-07-05)
  Location: 0,
  Restaurant: 0,
  Personnels: 0,
  Hôtels: 0,
  // Filet de sécurité
  Autres: 0.07,
};

/// Taux de référence pour une clé technique de catégorie.
export function referenceRate(category: string): number {
  const label = COMMISSION_CATEGORY_LABELS[category];
  if (!label) return REFERENCE_GRID.Autres;
  return REFERENCE_GRID[label] ?? REFERENCE_GRID.Autres;
}

/// Taux réellement configuré en base pour un pays + une catégorie.
///
/// Interroge `commission_rules` par LIBELLÉ ACCENTUÉ — la seule convention
/// vivante depuis le 2026-07-05, et celle que lit aussi l'app Flutter.
/// Repli sur la grille de référence si la ligne est absente ou la requête KO,
/// afin de ne jamais publier un produit sans commission.
export async function getCommissionRate(
  category: string,
  countryId: string | null | undefined
): Promise<number> {
  const label = COMMISSION_CATEGORY_LABELS[category];
  if (!label || !countryId) return referenceRate(category);

  const { data, error } = await supabase
    .from("commission_rules")
    .select("rate")
    .eq("country_id", countryId)
    .eq("category", label)
    .maybeSingle();

  if (error || data?.rate == null) return referenceRate(category);

  // `rate` est stocké en pourcentage entier (7.00 = 7 %).
  const rate = Number(data.rate) / 100;
  return Number.isFinite(rate) && rate >= 0 ? rate : referenceRate(category);
}

/// Décompose un prix vendeur selon l'invariant Rivendy.
///
///     commission = seller_price × taux
///     price affiché acheteur = seller_price + commission
///
/// Le vendeur encaisse EXACTEMENT `sellerPrice` — la commission s'ajoute
/// par-dessus, elle ne se déduit jamais du prix vendeur.
export function breakdown(sellerPrice: number, rate: number) {
  const safePrice = Number.isFinite(sellerPrice) && sellerPrice > 0 ? sellerPrice : 0;
  const commission = Number((safePrice * rate).toFixed(2));
  return {
    sellerPrice: safePrice,
    commission,
    displayPrice: Number((safePrice + commission).toFixed(2)),
  };
}
