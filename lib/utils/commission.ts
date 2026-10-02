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

// ═══════════════════════════════════════════════════════════════════════════
// GRILLE PAR PRIX — décision propriétaire du 2026-10-02
// ═══════════════════════════════════════════════════════════════════════════
// Le MONTANT de la commission dépend du prix vendeur, plus de la catégorie :
// 6 % jusqu'au premier seuil, 8 % jusqu'au second, 10 % au-delà, calculé PAR
// PORTION (comme eBay et Amazon), prix acheteur arrondi au pas de la monnaie,
// commission minimale 1 pas. Le taux de la catégorie (getCommissionRate) ne
// sert plus qu'à savoir si elle est EXONÉRÉE (0).
//
// ⚠️ QUATRE COPIES À TENIR ALIGNÉES (§1.4) :
//   rivendy_dashboard/supabase/migrations/20261002_commission_price_tiers.sql
//     (commission_price_tiers + commission_amount_for — fait foi : la base
//      refait le calcul à l'enregistrement),
//   rivendy_app/lib/features/checkout/services/commission_service.dart,
//   rivendy_dashboard/lib/commission-grid.ts, et PRICE_TIERS ci-dessous.

type PriceTiers = {
  low: number    // fin de la portion à 6 %
  high: number   // fin de la portion à 8 %
  step: number   // arrondi du prix acheteur
}
const RATES = { low: 6, mid: 8, high: 10 }   // en pourcentage
const MIN_STEPS = 1

/// Tableau validé par le propriétaire le 2026-10-02.
export const PRICE_TIERS: Record<string, PriceTiers> = {
  KM: { low: 50000,  high: 500000,  step: 50 },
  DJ: { low: 20000,  high: 200000,  step: 50 },
  SN: { low: 50000,  high: 500000,  step: 50 },
  CI: { low: 50000,  high: 500000,  step: 50 },
  ML: { low: 50000,  high: 500000,  step: 50 },
  BF: { low: 50000,  high: 500000,  step: 50 },
  CM: { low: 50000,  high: 500000,  step: 50 },
  FR: { low: 100,    high: 1000,    step: 0.5 },
  RE: { low: 100,    high: 1000,    step: 0.5 },
  YT: { low: 100,    high: 1000,    step: 0.5 },
  MG: { low: 500000, high: 5000000, step: 100 },
  KE: { low: 15000,  high: 150000,  step: 10 },
  ET: { low: 15000,  high: 150000,  step: 5 },
  TZ: { low: 300000, high: 3000000, step: 100 },
  MR: { low: 5000,   high: 50000,   step: 10 },
  SO: { low: 50000,  high: 500000,  step: 1000 },
};

/// Commission à AJOUTER au prix vendeur — miroir EXACT de
/// `commission_amount_for()` en base. Calcul en ENTIERS (centimes, taux en
/// pourcentage) : aucun arrondi flottant ne peut faire différer l'aperçu de
/// l'enregistrement. `rate` : 0 = catégorie exonérée ; sert aussi de repli
/// pour un marché sans grille (même repli que la base).
export function commissionForSellerPrice(
  sellerPrice: number,
  rate: number,
  countryId: string | null | undefined,
): number {
  if (!Number.isFinite(sellerPrice) || sellerPrice <= 0 || !(rate > 0)) return 0;
  const t = countryId ? PRICE_TIERS[countryId] : undefined;
  if (!t) return Number((sellerPrice * rate).toFixed(2));

  const sp = Math.round(sellerPrice * 100);
  const t1 = Math.round(t.low * 100);
  const t2 = Math.round(t.high * 100);
  const step = Math.round(t.step * 100);

  // Commission brute par portion, en centimes × 100.
  const raw100 = RATES.low * Math.min(sp, t1)
    + RATES.mid * Math.max(0, Math.min(sp, t2) - t1)
    + RATES.high * Math.max(0, sp - t2);

  // Prix acheteur arrondi au pas le plus proche (demi vers le haut).
  let finalCents = Math.floor((sp * 100 + raw100 + step * 50) / (step * 100)) * step;
  let commission = finalCents - sp;

  // Commission minimale : premier multiple du pas au-dessus de prix vendeur + minimum.
  if (commission < step * MIN_STEPS) {
    finalCents = Math.ceil((sp + step * MIN_STEPS) / step) * step;
    commission = finalCents - sp;
  }
  return commission / 100;
}

/// Décompose un prix vendeur selon l'invariant Rivendy.
///
///     commission = grille par prix (commissionForSellerPrice)
///     price affiché acheteur = seller_price + commission
///
/// Le vendeur encaisse EXACTEMENT `sellerPrice` — la commission s'ajoute
/// par-dessus, elle ne se déduit jamais du prix vendeur. `rate` = taux de la
/// catégorie : 0 l'exonère.
export function breakdown(sellerPrice: number, rate: number, countryId: string | null | undefined) {
  const safePrice = Number.isFinite(sellerPrice) && sellerPrice > 0 ? sellerPrice : 0;
  const commission = commissionForSellerPrice(safePrice, rate, countryId);
  return {
    sellerPrice: safePrice,
    commission,
    displayPrice: Number((safePrice + commission).toFixed(2)),
    /// Taux EFFECTIF, pour l'affichage (par portion et arrondi, il n'est pas rond).
    effectiveRate: safePrice > 0 ? commission / safePrice : 0,
  };
}
