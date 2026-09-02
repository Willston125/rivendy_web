"use client";

import { useState } from "react";
import { BedDouble, X, Smartphone } from "lucide-react";
import { HAS_APP_LINKS, storeUrlForUA } from "@/lib/config/app-links";

/**
 * Fiche hôtel héritée — CTA de réservation (flux WhatsApp GELÉ le 2026-09-02).
 *
 * ── CE QUE CE COMPOSANT FAISAIT ──────────────────────────────────────────────
 * Un formulaire (dates, personnes, besoins) qui traçait la demande dans
 * `hotel_reservation_requests` puis ouvrait `wa.me` vers le numéro AGENCE
 * Rivendy. Miroir web de `HotelReservationRequestSheet` côté Flutter.
 *
 * ── POURQUOI IL EST GELÉ ─────────────────────────────────────────────────────
 * Une demande WhatsApp ne réserve RIEN : aucune date bloquée, aucun inventaire
 * décrémenté, aucun prix recalculé côté serveur. §1.11 pose que le CTA d'un
 * hôtel est « Voir les chambres », jamais « Appeler » ni WhatsApp — c'est la
 * différence entre un annuaire et une plateforme de réservation.
 *
 * Le gel a été appliqué aux DEUX clients le même jour. Le rouvrir ici sans le
 * rouvrir dans l'app, ce serait le piège §1.10 qui recommence : une règle
 * respectée sur un seul client n'est pas respectée.
 *
 * `hotel_reservation_requests` n'est PAS supprimée : le dashboard
 * (« Demandes hôtel ») lit encore l'historique. Elle cesse simplement de
 * recevoir de nouvelles lignes.
 *
 * ── POURQUOI IL RENVOIE VERS L'APP, ET PAS VERS UNE FICHE ────────────────────
 * La réservation ferme (`hotel_create_booking`) n'existe que dans
 * l'application ; le site n'a pas d'univers Hôtels. Et même s'il en avait un,
 * aucun rapprochement automatique ne serait possible : cette page est indexée
 * par `seller_id`, le nouveau domaine par `hotels.id`, et l'entité `Hotel` n'a
 * délibérément aucun `seller_id` (cloisonnement §1.11).
 *
 * L'API publique du composant est INCHANGÉE — mêmes props, mêmes trois appels —
 * pour que le gel tienne dans un seul fichier.
 */
export function HotelReservationForm({
  hotelName,
  triggerLabel,
  className,
}: {
  /** Conservé pour la compatibilité des appels ; inutilisé depuis le gel. */
  sellerId?: string;
  hotelName: string;
  /** Conservé pour la compatibilité des appels ; inutilisé depuis le gel. */
  room?: { id: string; title: string } | null;
  triggerLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  /**
   * L'UA est lue au CLIC, jamais au rendu : la lire pendant le rendu
   * désynchroniserait le HTML serveur et le HTML client (hydratation).
   */
  function openStore() {
    const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
    window.open(storeUrlForUA(ua), "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        {triggerLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-6 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 className="flex items-center gap-2 text-base font-black text-slate-900">
                <BedDouble className="h-4 w-4 shrink-0 text-[#007168]" />
                Réserver {hotelName}
              </h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm leading-relaxed text-slate-600">
              La réservation d&apos;hôtel se fait désormais{" "}
              <strong className="font-semibold text-slate-800">
                dans l&apos;application Rivendy
              </strong>{" "}
              : vous choisissez vos dates, vous voyez les chambres réellement
              disponibles, et vous repartez avec une réservation confirmée et sa
              référence — pas une simple demande.
            </p>

            {HAS_APP_LINKS ? (
              <button
                onClick={openStore}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#009688] text-sm font-black text-white transition hover:bg-[#00897B]"
              >
                <Smartphone className="h-4 w-4" />
                Ouvrir l&apos;application Rivendy
              </button>
            ) : (
              <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                L&apos;application arrive très bientôt sur Google Play et
                l&apos;App Store.
              </p>
            )}

            <button
              onClick={() => setOpen(false)}
              className="mt-2 h-11 w-full rounded-xl text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
            >
              Continuer sur le site
            </button>
          </div>
        </div>
      )}
    </>
  );
}
