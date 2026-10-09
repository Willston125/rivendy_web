"use client";

import { useEffect } from "react";
import { useCountry } from "@/features/country/country-provider";

/**
 * Indique le marché de la page ouverte (article, boutique). Un visiteur qui
 * arrive par un lien partagé et n'a encore choisi aucun marché adopte celui de
 * l'article, au lieu de voir « Choisissez votre marché » s'ouvrir par-dessus.
 * Sans effet si un marché est déjà connu (profil, choix précédent, lien).
 */
export function MarketHint({ countryId }: { countryId?: string | null }) {
  const { suggestMarket } = useCountry();
  useEffect(() => {
    if (countryId) suggestMarket(countryId);
  }, [countryId, suggestMarket]);
  return null;
}
