"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleCheck, SearchX, WifiOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { getBookingByReference } from "@/lib/hotels/booking";
import { guestsLabel, nightsLabel, rangeLabel } from "@/lib/hotels/dates";
import { BOOKING_STATUS_LABELS, bookingStatusLine, collectionModelLabel, paymentOptionLabel } from "@/lib/hotels/labels";
import { isUpcomingStatus, type HotelBooking } from "@/lib/hotels/types";
import { BookingReferenceCard } from "./booking-reference-card";
import { HotelAuthGate } from "./hotel-auth-gate";
import { BlockSkeleton, StateBlock, StatusPills, useHotelMoney } from "./hotel-ui";

export function BookingConfirmationView() {
  return (
    <HotelAuthGate>
      <ConfirmationInner />
    </HotelAuthGate>
  );
}

/**
 * ✅ CONFIRMATION — atteinte en `router.replace` depuis le checkout : revenir
 * en arrière ne relance pas de réservation.
 *
 * Tout ce qui s'affiche est RELU en base (référence, statuts, total) : on
 * montre ce que le serveur a enregistré, pas ce que l'écran précédent
 * croyait avoir envoyé. Statut du séjour et statut du paiement restent
 * séparés : « Confirmée · À régler » est le cas nominal.
 */
function ConfirmationInner() {
  const params = useSearchParams();
  const reference = (params.get("ref") ?? "").trim().slice(0, 40);
  const [status, setStatus] = useState<"loading" | "ready" | "not_found" | "error">("loading");
  const [booking, setBooking] = useState<HotelBooking | null>(null);
  const [token, setToken] = useState(0);
  const money = useHotelMoney();

  useEffect(() => {
    if (!reference) {
      setStatus("not_found");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    getBookingByReference(supabase, reference)
      .then((b) => {
        if (cancelled) return;
        setBooking(b);
        setStatus(b ? "ready" : "not_found");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reference, token]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      {status === "loading" ? (
        <BlockSkeleton lines={6} />
      ) : status === "error" ? (
        <StateBlock icon={WifiOff} tone="error" title="Connexion interrompue" message="Votre réservation est enregistrée si vous avez reçu une référence. Réessayez pour l'afficher." action={{ label: "Réessayer", onClick: () => setToken((t) => t + 1) }} />
      ) : status === "not_found" || !booking ? (
        <StateBlock icon={SearchX} title="Réservation introuvable" message="Retrouvez toutes vos réservations dans votre espace." action={{ label: "Mes réservations", href: "/hotels/bookings" }} />
      ) : (
        <>
          <div className="text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E0F2F1] text-[#009688]">
              <CircleCheck className="h-9 w-9" aria-hidden />
            </span>
            <h1 className="mt-4 text-2xl font-black text-slate-950">
              {booking.bookingStatus === "confirmed" ? "Réservation confirmée" : `Réservation ${BOOKING_STATUS_LABELS[booking.bookingStatus].toLowerCase()}`}
            </h1>
            <p className="mt-1 text-sm text-slate-500" aria-label={bookingStatusLine(booking.bookingStatus, booking.paymentStatus)}>
              <StatusPills booking={booking.bookingStatus} payment={booking.paymentStatus} />
            </p>
          </div>

          <div className="mt-6">
            <BookingReferenceCard reference={booking.reference} showQr={isUpcomingStatus(booking.bookingStatus)} />
          </div>

          <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-lg font-black text-slate-950">{booking.hotelName || "Établissement"}</p>
            {booking.hotelCity ? <p className="text-sm text-slate-500">{booking.hotelCity}</p> : null}
            <dl className="mt-3 space-y-1.5 text-sm">
              <Row label="Dates" value={`${rangeLabel(booking.checkIn, booking.checkOut)} · ${nightsLabel(booking.nights)}`} />
              {booking.roomName ? <Row label="Chambre" value={booking.roomName} /> : null}
              <Row label="Voyageurs" value={guestsLabel(booking.adults, booking.children, booking.roomsCount)} />
              <Row label="Total" value={money(booking.totalAmount, booking.currency, booking.countryId)} strong />
              <Row label="Règlement" value={`${collectionModelLabel(booking.collectionModel)}${booking.paymentMethod ? ` · ${paymentOptionLabel(booking.paymentMethod)}` : ""}`} />
            </dl>
          </section>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href={`/hotels/bookings/${booking.id}`} className={buttonVariants({ size: "lg" })}>
              Voir ma réservation
            </Link>
            <Link href="/hotels" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Retour aux hôtels
            </Link>
          </div>
        </>
      )}
    </main>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={strong ? "font-black text-slate-950" : "font-semibold text-slate-800"}>{value}</dd>
    </div>
  );
}
