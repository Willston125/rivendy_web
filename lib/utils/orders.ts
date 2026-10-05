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

/* ── Groupage opérationnel côté VENDEUR — miroir de `_group` / `_statusChip`
   (seller_orders_screen.dart). Le vendeur n'agit pas sur la commande : il
   voit où elle en est chez Rivendy. ─────────────────────────────────────── */

const DELIVERY_FLOW = new Set([
  "assigned_to_delivery",
  "accepted_by_agent",
  "picked_up",
  "en_route",
  "in_delivery",
  "arrived",
  "code_generated",
  "awaiting_customer_confirmation",
  "delivered_by_rider",
]);
const DONE = new Set(["completed", "delivered_confirmed"]);

export type SellerOrderGroup = "toPrepare" | "inDelivery" | "waiting" | "done" | "cancelled";

export function sellerOrderGroup(status: string): SellerOrderGroup {
  if (status === "confirmed_by_customer_service") return "toPrepare";
  if (DELIVERY_FLOW.has(status)) return "inDelivery";
  if (DONE.has(status)) return "done";
  if (status === "cancelled" || status === "disputed") return "cancelled";
  // pending_whatsapp, pending, confirmed… : en cours chez Rivendy.
  return "waiting";
}

export const SELLER_ORDER_GROUP_LABELS: Record<SellerOrderGroup, string> = {
  toPrepare: "À préparer",
  inDelivery: "En livraison",
  waiting: "Reçue par Rivendy",
  done: "Terminée",
  cancelled: "Annulée",
};

/** Puce de statut côté vendeur (« Litige » distingué de « Annulée », comme l'app). */
export function sellerOrderChip(status: string): { label: string; className: string } {
  if (status === "disputed") return { label: "Litige", className: "bg-red-50 text-red-700" };
  switch (sellerOrderGroup(status)) {
    case "toPrepare":
      return { label: "À préparer", className: "bg-amber-50 text-amber-800" };
    case "inDelivery":
      return { label: "En livraison", className: "bg-blue-50 text-blue-700" };
    case "done":
      return { label: "Terminée", className: "bg-emerald-50 text-emerald-700" };
    case "cancelled":
      return { label: "Annulée", className: "bg-slate-100 text-slate-500" };
    default:
      return { label: "Reçue par Rivendy", className: "bg-[#E0F2F1] text-[#00796B]" };
  }
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
