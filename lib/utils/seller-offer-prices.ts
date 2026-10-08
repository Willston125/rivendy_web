/**
 * Grille des offres vendeur (abonnement Certifié/Pro et boosts) PAR MARCHÉ.
 *
 * Décision D-1 du 2026-10-08 (audit n°2). Avant, seuls DJ et KM avaient un
 * prix : les 14 autres marchés payaient le CHIFFRE de Djibouti dans leur
 * propre devise (« 1 500 FCFA » au Sénégal, soit ~2,30 € au lieu de ~6 €).
 *
 * Référence : prix des Comores convertis en euros, arrondis à des montants
 * ronds de chaque monnaie. DJ et KM gardent leurs prix du 2026-08-09.
 * Annuel = 10 mois payés.
 *
 * ⚠️ MIROIR EXACT de `rivendy_app/lib/core/constants/seller_offer_prices.dart`
 * (garde-fou : test/features/auth/subscription_plans_test.dart) et de
 * `rivendy_dashboard/lib/subscription-grid.ts`. Modifier les TROIS ensemble.
 * Garde-fou web : scripts/check-seller-offer-prices.mjs (`npm run check`).
 */

export type OfferTier = "certified" | "pro";
export type OfferPlan = "monthly" | "yearly";

/** Annuel = 10 mois payés (deux mois offerts). */
export const YEARLY_PAID_MONTHS = 10;

type OfferPrices = {
  certifiedMonthly: number;
  proMonthly: number;
  boost3Days: number;
  boost7Days: number;
  boost15Days: number;
};

const FCFA: OfferPrices = { certifiedMonthly: 4000, proMonthly: 10000, boost3Days: 1500, boost7Days: 5000, boost15Days: 10000 };
const EURO: OfferPrices = { certifiedMonthly: 6, proMonthly: 15, boost3Days: 2.5, boost7Days: 7.5, boost15Days: 15 };

export const SELLER_OFFER_PRICES: Record<string, OfferPrices> = {
  DJ: { certifiedMonthly: 1500, proMonthly: 3500, boost3Days: 500, boost7Days: 1500, boost15Days: 3000 },
  KM: { certifiedMonthly: 3000, proMonthly: 7500, boost3Days: 1250, boost7Days: 3750, boost15Days: 7500 },
  SN: FCFA,
  CI: FCFA,
  ML: FCFA,
  BF: FCFA,
  CM: FCFA,
  FR: EURO,
  RE: EURO,
  YT: EURO,
  MG: { certifiedMonthly: 30000, proMonthly: 75000, boost3Days: 12500, boost7Days: 37500, boost15Days: 75000 },
  KE: { certifiedMonthly: 900, proMonthly: 2300, boost3Days: 400, boost7Days: 1100, boost15Days: 2300 },
  ET: { certifiedMonthly: 1000, proMonthly: 2500, boost3Days: 400, boost7Days: 1200, boost15Days: 2500 },
  TZ: { certifiedMonthly: 18000, proMonthly: 45000, boost3Days: 7500, boost7Days: 22000, boost15Days: 45000 },
  MR: { certifiedMonthly: 250, proMonthly: 650, boost3Days: 100, boost7Days: 350, boost15Days: 650 },
  SO: { certifiedMonthly: 4000, proMonthly: 10000, boost3Days: 2000, boost7Days: 5000, boost15Days: 10000 },
};

/**
 * Grille du marché. Un marché vide ou inconnu ne peut rien ACHETER (les deux
 * écrans exigent un marché) : le repli sur Djibouti ne sert qu'à l'affichage
 * transitoire, comme `sellerOfferPricesFor()` côté app.
 */
function pricesFor(countryId: string | null | undefined): OfferPrices {
  return SELLER_OFFER_PRICES[(countryId ?? "").trim().toUpperCase()] ?? SELLER_OFFER_PRICES.DJ;
}

export function subscriptionPriceFor(
  tier: OfferTier,
  plan: OfferPlan,
  countryId: string | null | undefined,
): number {
  const p = pricesFor(countryId);
  const monthly = tier === "pro" ? p.proMonthly : p.certifiedMonthly;
  return plan === "yearly" ? monthly * YEARLY_PAID_MONTHS : monthly;
}

export function boostPriceFor(durationDays: number, countryId: string | null | undefined): number {
  const p = pricesFor(countryId);
  if (durationDays === 3) return p.boost3Days;
  if (durationDays === 7) return p.boost7Days;
  if (durationDays === 15) return p.boost15Days;
  throw new Error(`Durée de boost inconnue : ${durationDays} jours`);
}

/**
 * Retrait minimum par marché (décision DV-1 du 2026-10-08) : ~10 € dans la
 * devise du PORTEFEUILLE. Avant : 5 000 aux Comores, 2 000 partout ailleurs
 * (2 000 € en France). Miroir EXACT de `kMinWithdrawalByMarket` (app) et du
 * contrôle serveur `guard_payout_insert()`. Marché inconnu : 0 (le serveur tranche).
 */
export const MIN_WITHDRAWAL_BY_MARKET: Record<string, number> = {
  KM: 5000, DJ: 2000,
  SN: 7000, CI: 7000, ML: 7000, BF: 7000, CM: 7000,
  FR: 10, RE: 10, YT: 10,
  MG: 50000, KE: 1500, ET: 1500, TZ: 30000, MR: 500, SO: 7000,
};

export function minWithdrawalFor(countryId: string | null | undefined): number {
  return MIN_WITHDRAWAL_BY_MARKET[(countryId ?? "").trim().toUpperCase()] ?? 0;
}
