/**
 * Zones de livraison PAYANTES hors parcours structuré — miroir EXACT de
 * `rivendy_app/lib/core/utils/delivery_zones.dart` (`DeliveryZones.djibouti`).
 * Modifier les DEUX ensemble.
 *
 * Décision propriétaire du 2026-10-06 (DEC-2) : à Djibouti, les frais de
 * zone sont facturés ET enregistrés dans la commande (`delivery_fee_kmf`,
 * montant natif du marché malgré son nom) sur les deux clients. Jusque-là,
 * l'app les affichait et les encaissait sans les enregistrer, et le site
 * n'en demandait aucun.
 *
 * Les Comores ont leur parcours structuré (`delivery-location.ts`) ; les
 * autres marchés n'ont pas de grille : adresse libre, tarif confirmé par
 * Rivendy.
 */
export interface PricedDeliveryZone {
  id: string;
  label: string;
  fee: number;
}

const PRICED_ZONES: Record<string, PricedDeliveryZone[]> = {
  DJ: [
    { id: "dj_same_quartier", label: "Même quartier", fee: 500 },
    { id: "dj_djibouti_ville", label: "Djibouti-ville", fee: 1000 },
    { id: "dj_peripherie", label: "Zone périphérique", fee: 2500 },
  ],
};

/** Zones payantes d'un marché (vide s'il n'a pas de grille). */
export function pricedZonesFor(countryId?: string | null): PricedDeliveryZone[] {
  return (countryId && PRICED_ZONES[countryId]) || [];
}
