/**
 * 🏷️ LIBELLÉS DU DOMAINE HÔTELIER — miroir de
 * `rivendy_app/lib/features/hotels/models/hotel_booking.dart`,
 * `hotel_quote.dart`, `hotel_room.dart` et `hotel_review.dart`.
 *
 * ⚠️ `booking_status` et `payment_status` sont INDÉPENDANTS (décision
 * propriétaire du 2026-08-24) : « Confirmée · À régler » est le cas nominal
 * du paiement à l'hôtel, pas une anomalie. Ne jamais déduire l'un de l'autre.
 */

import type {
  BookingStatus,
  HotelErrorCode,
  HotelImageCategory,
  HotelPaymentOption,
  HotelServiceUnit,
  PaymentStatus,
} from "./types";

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "En attente",
  awaiting_payment: "Paiement attendu",
  confirmed: "Confirmée",
  checked_in: "En séjour",
  completed: "Terminée",
  cancelled: "Annulée",
  no_show: "Non présenté",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "À régler",
  paid: "Payé",
  failed: "Échec",
  refunded: "Remboursé",
  partially_refunded: "Partiellement remboursé",
};

/** « Confirmée · À régler » — les deux statuts côte à côte, jamais fusionnés. */
export function bookingStatusLine(booking: BookingStatus, payment: PaymentStatus): string {
  return `${BOOKING_STATUS_LABELS[booking]} · ${PAYMENT_STATUS_LABELS[payment]}`;
}

/** Couleur de pastille du statut de séjour (classes Tailwind standard). */
export function bookingStatusTone(s: BookingStatus): string {
  switch (s) {
    case "confirmed":
    case "checked_in":
      return "bg-[#E0F2F1] text-[#007168]";
    case "completed":
      return "bg-slate-100 text-slate-700";
    case "cancelled":
    case "no_show":
      return "bg-red-50 text-red-700";
    default:
      return "bg-amber-50 text-amber-700";
  }
}

/** Couleur de pastille du statut de paiement. */
export function paymentStatusTone(s: PaymentStatus): string {
  switch (s) {
    case "paid":
      return "bg-emerald-50 text-emerald-700";
    case "failed":
      return "bg-red-50 text-red-700";
    case "refunded":
    case "partially_refunded":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-amber-50 text-amber-700";
  }
}

/**
 * QUI encaisse — sans rien affirmer sur l'état du paiement.
 *
 * ⚠️ Écart volontaire avec l'app : `PaymentCollectionModel.label` y vaut
 * « Payé sur Rivendy » pour `platform_collect`, ce qui se lit « déjà payé »
 * même quand `payment_status = pending`. L'état de l'argent est porté par
 * `PAYMENT_STATUS_LABELS`, ce libellé-ci ne dit que le CANAL.
 */
export function collectionModelLabel(model: "platform_collect" | "property_collect"): string {
  return model === "platform_collect" ? "Paiement via Rivendy" : "Paiement à l'hôtel";
}

/** Libellé d'un moyen de paiement — miroir de `HotelPaymentOption.label`. Code inconnu affiché tel quel. */
export function paymentOptionLabel(methodCode: string): string {
  switch (methodCode) {
    case "cash_on_site":
      return "Paiement à l'hôtel";
    case "card_on_site":
      return "Carte à l'hôtel";
    case "huri_money":
      return "Huri Money";
    case "wakati":
      return "Wakati";
    case "mvola":
      return "MVola";
    case "waafi":
      return "Waafi";
    case "d_money":
      return "D-Money";
    case "cac_pay":
      return "CAC Pay";
    default:
      return methodCode || "Moyen de paiement";
  }
}

/** Indication sous le moyen de paiement — miroir de `HotelPaymentOption.hint`. */
export function paymentOptionHint(option: HotelPaymentOption): string {
  if (option.methodCode === "cash_on_site") return "Réglez en espèces à votre arrivée";
  if (option.methodCode === "card_on_site") return "Réglez par carte à votre arrivée";
  return option.collectionModel === "platform_collect"
    ? "Paiement sécurisé via Rivendy"
    : "Réglé directement auprès de l'établissement";
}

/** Messages utilisateur des refus serveur — jamais un code technique à l'écran. */
export const HOTEL_ERROR_MESSAGES: Record<HotelErrorCode, string> = {
  invalid_dates: "La date de départ doit être après la date d'arrivée.",
  past_date: "Cette date est déjà passée. Choisissez une date à venir.",
  room_not_found: "Cette chambre n'est plus proposée.",
  bookings_closed: "Cet hôtel n'accepte pas de réservation pour le moment.",
  capacity_exceeded: "Cette chambre ne peut pas accueillir autant de voyageurs.",
  room_unavailable: "Cette chambre vient d'être réservée.",
  not_authenticated: "Connectez-vous pour réserver.",
  booking_not_found: "Réservation introuvable.",
  forbidden: "Cette réservation n'est pas rattachée à votre compte.",
  not_cancellable: "Cette réservation ne peut plus être annulée.",
  not_modifiable: "Cette réservation ne peut plus être modifiée.",
  service_not_found: "Ce service n'est plus proposé par l'établissement.",
  network: "Connexion interrompue. Vérifiez votre réseau et réessayez.",
  unknown: "La réservation n'a pas pu aboutir. Réessayez dans un instant.",
};

/** Message quand le devis est valide mais la chambre n'est pas libre sur toutes les nuits. */
export const QUOTE_UNAVAILABLE_MESSAGE =
  "Cette chambre n'est plus disponible sur toutes les nuits de votre séjour.";

/** Suffixe affiché après le prix d'un service — miroir de `HotelServiceUnit.suffix`. */
export const SERVICE_UNIT_SUFFIX: Record<HotelServiceUnit, string> = {
  sejour: "/ séjour",
  nuit: "/ nuit",
  personne: "/ personne",
  personne_nuit: "/ personne / nuit",
};

export const IMAGE_CATEGORY_LABELS: Record<HotelImageCategory, string> = {
  exterieur: "Extérieur",
  chambres: "Chambres",
  piscine: "Piscine",
  restaurant: "Restaurant",
  reception: "Réception",
  salle_de_bain: "Salle de bain",
  vue: "Vue",
  autres: "Autres",
};

export const AMENITY_CATEGORY_LABELS: Record<string, string> = {
  general: "Général",
  confort: "Confort",
  loisirs: "Loisirs",
  services: "Services",
  situation: "Situation",
};

/** Appréciation à la Booking — miroir de `HotelRatingBreakdown.label`. */
export function ratingLabel(average: number, count: number): string {
  if (count <= 0) return "Nouveau";
  if (average >= 4.5) return "Exceptionnel";
  if (average >= 4.0) return "Excellent";
  if (average >= 3.5) return "Très bien";
  if (average >= 3.0) return "Bien";
  return "Correct";
}

/** Libellé d'une note donnée au formulaire d'avis — miroir de la feuille d'avis de l'app. */
export function starPickLabel(rating: number): string {
  switch (rating) {
    case 5:
      return "Exceptionnel";
    case 4:
      return "Très bien";
    case 3:
      return "Bien";
    case 2:
      return "Décevant";
    case 1:
      return "Mauvais";
    default:
      return "Choisissez une note";
  }
}

/** « 4,5 » — virgule décimale française. */
export function formatRating(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

/**
 * Nom public d'un auteur d'avis : prénom + initiale. Un avis est public,
 * le nom complet d'un voyageur n'a pas à l'être.
 */
export function reviewerDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Voyageur vérifié";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}
