import type { Country, OrderStatus } from "@/types/rivendy";

/**
 * Référence de commande telle que l'acheteur doit la citer au support :
 * l'identifiant COMPLET (`CMD-AAAAMMJJ-XXXXXX`), comme l'app
 * (my_orders_screen.dart). Jusqu'au 2026-10-04 le site affichait
 * `id.split("-")[0]`, c'est-à-dire « CMD » pour TOUTES les commandes.
 */
export function orderReference(id: string): string {
  return (id ?? "").trim().toUpperCase();
}

/**
 * Libellés des statuts — mêmes mots que l'app et que les notifications depuis
 * le parcours de réception du 2026-10-02 (`order_status.dart`). Source unique
 * côté site : profil, espace vendeur, notifications.
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_whatsapp: "En cours de validation",
  confirmed_by_customer_service: "Validée",
  payment_received_cash: "Paiement reçu",
  assigned_to_delivery: "En cours de livraison",
  accepted_by_agent: "Pris en charge",
  picked_up: "Récupérée",
  en_route: "En route",
  arrived: "Livreur arrivé",
  code_generated: "Code envoyé",
  awaiting_customer_confirmation: "Livreur chez vous",
  // Le livreur l'a déclarée livrée, l'acheteur n'a pas encore confirmé : les
  // fonds du vendeur attendent. Ce n'est PAS « Livrée ».
  delivered_by_rider: "Livrée — à confirmer",
  delivered_confirmed: "Réception confirmée",
  completed: "Terminée",
  cancelled: "Annulée",
  pending: "En cours de validation",
  confirmed: "Validée",
  in_delivery: "En livraison",
  disputed: "Litige en cours",
  shipped: "Expédiée",
  delivered: "Livrée",
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
}

/**
 * Pays dans lequel une commande a été passée : c'est lui qui fixe la devise
 * de ses montants, pas le marché affiché à l'écran. Repli sur le marché
 * courant pour les anciennes commandes sans `country_id`.
 */
export function orderCountry(
  orderCountryId: string | null | undefined,
  countries: Country[],
  fallback: Country | null,
): Country | null {
  if (orderCountryId) {
    const found = countries.find((c) => c.id === orderCountryId);
    if (found) return found;
  }
  return fallback;
}
