/**
 * Réduction de livraison au panier — règles PURES d'affichage (formules
 * simplifiées, lot 3, 2026-11-17). Sans import : testées sous Node par
 * `node --test features/checkout/delivery-benefit.test.mjs`
 * (npm run check:delivery).
 *
 * Le site ne CALCULE pas la réduction : il affiche ce que rend le serveur
 * (dépôt dashboard, 20261115_1300_formules_4_livraison.sql) :
 *  - avant la commande, `rivendy_delivery_quote(p_products_total,
 *    p_delivery_fee)` : même calcul que la commande, rien consommé ;
 *  - après, la réponse de `secure_create_order` (delivery_fee_kmf = part de
 *    l'acheteur, delivery_rivendy_share, delivery_benefit, delivery_group =
 *    la commande qui porte la livraison d'un panier, recalculée).
 * La part offerte est payée par Rivendy : le vendeur reçoit toujours son prix
 * et les frais restent hors de orders.total_price.
 */

export type DeliveryBenefit = "credit" | "half_threshold" | "full_threshold";

export interface DeliveryQuote {
  success: boolean;
  error?: string;
  benefit?: DeliveryBenefit | null;
  fee_full?: number;
  rivendy_share?: number;
  buyer_fee?: number;
  credits_per_cycle?: number | null;
  credits_remaining?: number | null;
  credit_full_until?: number | null;
  credit_partial_percent?: number | null;
  half_threshold?: number | null;
  half_percent?: number | null;
  full_threshold?: number | null;
  currency?: string | null;
  cycle_end?: string | null;
}

export interface DeliveryDisplay {
  /** Tarif de la zone. */
  feeFull: number;
  /** Part payée par Rivendy. */
  share: number;
  /** Ce que paie l'acheteur (au livreur). */
  buyerFee: number;
  /** Ligne de la réduction (« Offerte par Rivendy+ »), ou null. */
  label: string | null;
  /** Précision sous la réduction (« Livraison offerte : 1 sur 2 ce mois-ci. »). */
  detail: string | null;
  /** Coup de pouce (« Encore 3 500 KMF d'articles : … »), ou null. */
  nudge: string | null;
}

/** Un coup de pouce n'a de sens que près du seuil : 60 % du seuil au moins. */
export const NUDGE_FROM = 0.6;

const n = (v: unknown): number => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

function shareLabel(pct: number, who: "Rivendy+" | "Rivendy"): string {
  if (who === "Rivendy+") return pct >= 100 ? "Offerte par Rivendy+" : pct === 50 ? "Moitié offerte par Rivendy+" : `${pct} % offerts par Rivendy+`;
  return pct >= 100 ? "Offerte par Rivendy" : pct === 50 ? "Moitié payée par Rivendy" : `${pct} % payés par Rivendy`;
}

/**
 * Ce que le récapitulatif affiche pour une livraison de `fee` et des
 * articles pour `productsTotal`, d'après l'aperçu du serveur (null = pas
 * d'aperçu : tarif plein, rien promis).
 */
export function deliveryDisplay(
  q: DeliveryQuote | null, fee: number, productsTotal: number, money: (amount: number) => string,
): DeliveryDisplay {
  const feeFull = Math.max(0, Math.round(n(fee)));
  const none: DeliveryDisplay = { feeFull, share: 0, buyerFee: feeFull, label: null, detail: null, nudge: null };
  if (!q?.success || feeFull === 0 || n(q.fee_full) !== feeFull) return none;

  const share = Math.min(Math.max(Math.round(n(q.rivendy_share)), 0), feeFull);
  const pct = Math.round((share * 100) / feeFull);
  const per = n(q.credits_per_cycle);
  const remaining = n(q.credits_remaining);
  const half = n(q.half_threshold);
  const halfPct = n(q.half_percent);
  const full = n(q.full_threshold);
  let label: string | null = null;
  let detail: string | null = null;

  if (share > 0 && q.benefit === "credit") {
    label = shareLabel(pct, "Rivendy+");
    const index = Math.min(Math.max(per - remaining + 1, 1), Math.max(per, 1));
    detail = per > 0 ? `Livraison offerte : ${index} sur ${per} ce mois-ci.` : null;
    const until = n(q.credit_full_until);
    if (share < feeFull && until > 0) {
      const partial = n(q.credit_partial_percent);
      detail = `${detail ? `${detail} ` : ""}Au-delà de ${money(until)} de livraison, elle en paie ${partial === 50 ? "la moitié" : `${partial} %`}.`;
    }
  } else if (share > 0 && q.benefit === "full_threshold") {
    label = `Offerte dès ${money(full)} d’articles`;
    detail = per > 0 && remaining > 0 ? "Vos livraisons offertes du mois restent pour une autre commande." : null;
  } else if (share > 0 && q.benefit === "half_threshold") {
    label = shareLabel(pct, "Rivendy");
    detail = half > 0 ? `Commande de ${money(half)} ou plus.` : null;
  }

  let nudge: string | null = null;
  const total = n(productsTotal);
  if (share < feeFull) {
    if (full > 0 && total < full && total >= full * NUDGE_FROM) {
      nudge = `Encore ${money(full - total)} d’articles : la livraison est offerte.`;
    } else if (half > 0 && halfPct > 0 && total < half && total >= half * NUDGE_FROM
      && Math.round((feeFull * halfPct) / 100) > share) {
      nudge = `Encore ${money(half - total)} d’articles : Rivendy paie ${halfPct === 50 ? "la moitié de la livraison" : `${halfPct} % de la livraison`}.`;
    }
  }
  return { feeFull, share, buyerFee: feeFull - share, label, detail, nudge };
}

/** Une commande créée, telle que la rend `secure_create_order`. */
export interface CreatedOrder {
  total_price?: number | string | null;
  delivery_fee_kmf?: number | null;
  delivery_fee_full?: number | null;
  delivery_rivendy_share?: number | null;
  delivery_benefit?: string | null;
  delivery_group?: {
    fee_full?: number | null;
    rivendy_share?: number | null;
    buyer_fee?: number | null;
    benefit?: string | null;
  } | null;
}

export interface OrderTotals {
  products: number;
  feeFull: number;
  share: number;
  buyerFee: number;
  benefit: string | null;
  amountDue: number;
}

/**
 * Totaux d'un passage en caisse, d'après ce que le SERVEUR a enregistré :
 * pour un panier chez plusieurs vendeurs, la livraison est portée par une
 * seule commande et recalculée à chaque commande ajoutée (delivery_group) ;
 * le dernier recalcul fait foi.
 */
export function orderTotals(results: CreatedOrder[]): OrderTotals {
  const products = results.reduce((s, r) => s + n(r.total_price), 0);
  const group = [...results].reverse().find((r) => r.delivery_group)?.delivery_group ?? null;
  const lead = results.find((r) => n(r.delivery_fee_full) > 0) ?? null;
  let feeFull = 0;
  let share = 0;
  let buyerFee = 0;
  let benefit: string | null = null;
  if (group) {
    feeFull = n(group.fee_full);
    share = n(group.rivendy_share);
    buyerFee = n(group.buyer_fee);
    benefit = group.benefit ?? null;
  } else if (lead) {
    feeFull = n(lead.delivery_fee_full);
    share = n(lead.delivery_rivendy_share);
    buyerFee = n(lead.delivery_fee_kmf);
    benefit = lead.delivery_benefit ?? null;
  }
  return { products, feeFull, share, buyerFee, benefit: share > 0 ? benefit : null, amountDue: products + buyerFee };
}

/** Phrase de la part payée par Rivendy (confirmation, Mes commandes). */
export function benefitSentence(benefit: string | null | undefined, share: number, money: (amount: number) => string): string | null {
  if (!(share > 0)) return null;
  switch (benefit) {
    case "credit": return `Rivendy+ vous offre ${money(share)} de livraison.`;
    case "full_threshold": return `Livraison offerte : Rivendy paie ${money(share)}.`;
    case "half_threshold": return `Rivendy paie ${money(share)} de la livraison.`;
    default: return `Rivendy paie ${money(share)} de la livraison.`;
  }
}
