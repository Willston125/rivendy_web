"use client";

import Link from "next/link";
import { useCountry } from "@/features/country/country-provider";

/**
 * Fiche hôtel héritée — CTA de réservation.
 *
 * Le flux WhatsApp (demande tracée dans `hotel_reservation_requests` puis
 * `wa.me` vers l'agence) est GELÉ depuis le 2026-09-02 sur les DEUX clients
 * (§1.11) : une demande ne réserve rien. `hotel_reservation_requests` reste
 * lue par le dashboard pour l'historique.
 *
 * Depuis le 2026-10-04, le site a son module de réservation ferme (`/hotels`,
 * comme l'app) : le CTA y mène directement — même geste que la passerelle
 * de l'app (« Voir les hôtels réservables »). Aucun rapprochement automatique
 * vers UNE fiche n'est possible : cette page est indexée par `seller_id`, le
 * domaine hôtelier par `hotels.id`, sans lien entre les deux (décision
 * propriétaire `hotels.legacy_seller_id` en attente).
 *
 * L'API publique est inchangée — mêmes props, mêmes appels.
 */
export function HotelReservationForm({
  triggerLabel,
  className,
}: {
  /** Conservé pour la compatibilité des appels. */
  sellerId?: string;
  /** Conservé pour la compatibilité des appels. */
  hotelName: string;
  /** Conservé pour la compatibilité des appels. */
  room?: { id: string; title: string } | null;
  triggerLabel: string;
  className?: string;
}) {
  const { country } = useCountry();
  const href = country?.id ? `/hotels?country=${country.id}` : "/hotels";
  return (
    <Link href={href} className={className} title="Voir les hôtels réservables en ligne">
      {triggerLabel}
    </Link>
  );
}
