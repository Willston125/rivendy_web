"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Heart } from "lucide-react";
import { ShareButton } from "@/components/ui/share-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { validateStayDates, nightCount } from "@/lib/hotels/availability";
import { nightsLabel, rangeLabel } from "@/lib/hotels/dates";
import { draftHref, type Guests } from "@/lib/hotels/search-params";
import { GuestPicker, StayDatesFields, useTodaySql } from "./hotel-search-form";
import { useHotelFavorites } from "./use-hotel-favorites";

/** Favori + partage de la fiche. */
export function HotelDetailActions({ hotelId, hotelName }: { hotelId: string; hotelName: string }) {
  const favorites = useHotelFavorites();
  const fav = favorites.isFavorite(hotelId);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => favorites.toggle(hotelId)}
        disabled={favorites.isPending(hotelId)}
        aria-pressed={fav}
        aria-label={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60"
      >
        <Heart className={cn("h-5 w-5", fav ? "fill-red-500 text-red-500" : "text-slate-700")} aria-hidden />
      </button>
      <ShareButton
        title={hotelName}
        text={`${hotelName} — sur Rivendy`}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50"
      />
    </div>
  );
}

/**
 * Boîte de séjour + CTA principal.
 *
 * ⚠️ Le CTA est « Voir les chambres » — jamais « Appeler » ni WhatsApp
 * (PROTECTED_ZONES §1.11). « Complet » quand l'hôtelier a fermé les
 * réservations ; désactivé quand aucune chambre n'est publiée.
 */
export function HotelStayBox({
  hotelId,
  fromPrice,
  hasRooms,
  acceptingBookings,
  initial,
}: {
  hotelId: string;
  /** « À partir de » déjà formaté côté serveur, ou null. */
  fromPrice: string | null;
  hasRooms: boolean;
  acceptingBookings: boolean;
  initial: Guests & { checkIn: string | null; checkOut: string | null };
}) {
  const router = useRouter();
  const today = useTodaySql();
  const [checkIn, setCheckIn] = useState(initial.checkIn);
  const [checkOut, setCheckOut] = useState(initial.checkOut);
  const [guests, setGuests] = useState<Guests>({ rooms: initial.rooms, adults: initial.adults, children: initial.children });
  const [error, setError] = useState<string | null>(null);
  const canBook = hasRooms && acceptingBookings;
  const nights = checkIn && checkOut ? nightCount(checkIn, checkOut) : 0;

  function onSeeRooms() {
    if (!canBook) return;
    if (!checkIn || !checkOut) {
      setError("Choisissez vos dates pour voir les disponibilités.");
      return;
    }
    const problem = validateStayDates({ checkIn, checkOut, today: today ?? undefined });
    if (problem) {
      setError(problem);
      return;
    }
    router.push(
      draftHref("rooms", { hotelId, checkIn, checkOut, ...guests, roomId: null, serviceIds: [] }),
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      {hasRooms && fromPrice ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">À partir de</p>
          <p className="text-2xl font-black text-slate-950">
            {fromPrice} <span className="text-sm font-semibold text-slate-500">/ nuit</span>
          </p>
          <p className="text-xs text-slate-500">Tarif de référence ; le prix exact de votre séjour est calculé à l&apos;étape suivante.</p>
        </div>
      ) : (
        <p className="text-sm font-bold text-slate-700">Aucune chambre publiée pour le moment</p>
      )}

      {canBook ? (
        <div className="mt-4 space-y-3">
          <StayDatesFields
            checkIn={checkIn}
            checkOut={checkOut}
            today={today}
            onChange={(a, b) => {
              setError(null);
              setCheckIn(a);
              setCheckOut(b);
            }}
          />
          <GuestPicker value={guests} onChange={setGuests} />
          {nights > 0 ? (
            <p className="text-xs font-semibold text-slate-500">
              {rangeLabel(checkIn, checkOut)} · {nightsLabel(nights)}
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="button" size="lg" className="mt-4 w-full" disabled={!canBook} onClick={onSeeRooms}>
        {acceptingBookings ? "Voir les chambres" : "Complet"}
      </Button>
      {!acceptingBookings ? (
        <p className="mt-2 text-center text-xs text-slate-500">Cet hôtel n&apos;accepte pas de réservation pour le moment.</p>
      ) : null}
    </div>
  );
}
