/**
 * Panier du site — règles pures, testées (cart-logic.test.mjs).
 * Audit 20 : WEB-2 (marchés), WEB-4 (variantes), WEB-5 (stock). Côté app :
 * `CartProvider.stockLimitMessage` et `formatSumsByMarket`.
 */

/** « Commander maintenant » : l'article voyage hors du panier (sessionStorage). */
export const BUY_NOW_KEY = "rivendy_buy_now";

type Stocked = { stock_quantity?: number | null };

/** Quantité permise : le stock connu ; stock non renseigné : pas de plafond. */
export function cappedQuantity(product: Stocked, wanted: number): number {
  const stock = product.stock_quantity;
  if (stock === null || stock === undefined) return wanted;
  return Math.min(wanted, Math.max(0, Number(stock)));
}

/** Peut-on en ajouter une de plus ? */
export function canAddMore(product: Stocked, quantity: number): boolean {
  return cappedQuantity(product, quantity + 1) > quantity;
}

function list(value: string | null | undefined): string[] {
  return (value ?? "").split(",").map((part) => part.trim()).filter(Boolean);
}

type WithVariants = { extra_attributes?: { sizes?: string; colors?: string } | null };

/** Tailles et couleurs proposées par le vendeur. */
export function variantOptions(product: WithVariants): { sizes: string[]; colors: string[] } {
  return { sizes: list(product.extra_attributes?.sizes), colors: list(product.extra_attributes?.colors) };
}

export function hasVariants(product: WithVariants): boolean {
  const { sizes, colors } = variantOptions(product);
  return sizes.length > 0 || colors.length > 0;
}

/** Marchés distincts d'un panier, dans l'ordre des articles. */
export function cartMarkets(items: Array<{ product: { country_id?: string | null } }>): string[] {
  return [...new Set(items.map((item) => item.product.country_id).filter((id): id is string => Boolean(id)))];
}
