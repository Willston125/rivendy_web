import { formatMoney } from "@/lib/utils/format";
import type { Country } from "@/types/rivendy";

/**
 * Formate un montant hôtelier avec la monnaie de L'HÔTEL, jamais celle du
 * marché affiché ni une devise en dur.
 *
 * Les montants d'une chambre, d'un devis ou d'une réservation portent leur
 * propre code (`currency`). On prend le symbole du pays de l'établissement
 * quand il désigne bien cette monnaie ; sinon le code lui-même.
 */
export function formatHotelMoney(
  amount: number,
  currencyCode: string,
  countryId: string | null | undefined,
  countries: Pick<Country, "id" | "currency_code" | "currency_symbol">[],
): string {
  const country = countries.find((c) => c.id === countryId);
  if (country && (!currencyCode || country.currency_code === currencyCode)) {
    return formatMoney(amount, country);
  }
  const code = currencyCode || country?.currency_code || "";
  return formatMoney(amount, { currency_code: code, currency_symbol: code });
}
