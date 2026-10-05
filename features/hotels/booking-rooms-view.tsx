"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BedDouble, CalendarX, CircleCheck, Flame, LoaderCircle, SearchX, WifiOff } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import {
  firstUnavailableNight,
  fitsCapacity,
  minAvailableAcrossNights,
  nightsOfStay,
  previewRoomSubtotal,
  validateStayDates,
} from "@/lib/hotels/availability";
import { getInventory } from "@/lib/hotels/catalog";
import { requestQuote } from "@/lib/hotels/booking";
import { dayMonthLabel } from "@/lib/hotels/dates";
import { HOTEL_ERROR_MESSAGES, QUOTE_UNAVAILABLE_MESSAGE } from "@/lib/hotels/labels";
import { draftHref, hotelHref } from "@/lib/hotels/search-params";
import { roomSummaryLabel, type HotelRoom, type InventoryByDate, type RateByDate } from "@/lib/hotels/types";
import { StaySummary } from "./booking-summary";
import { useTodaySql } from "./hotel-search-form";
import { BlockSkeleton, BookingSteps, HotelImg, StateBlock, useHotelMoney } from "./hotel-ui";
import { useDraftContext, useDraftFromUrl } from "./use-booking-draft";

/**
 * 🛏️ CHOIX DE LA CHAMBRE — miroir de `HotelRoomSelectionScreen`.
 *
 * Premier écran qui confronte les chambres à l'INVENTAIRE PAR DATE. Ce
 * qu'il montre est un APERÇU : au clic, un devis serveur tranche. Écart
 * volontaire avec l'app : un devis `ok` mais `is_available: false` BLOQUE
 * (l'app laissait passer à l'étape suivante).
 */
export function BookingRoomsView() {
  const router = useRouter();
  const today = useTodaySql();
  const { draft } = useDraftFromUrl();
  const ctx = useDraftContext(draft);
  const money = useHotelMoney();

  const nights = useMemo(() => (draft ? nightsOfStay(draft.checkIn, draft.checkOut) : []), [draft]);
  const [inventory, setInventory] = useState<Map<string, InventoryByDate>>(new Map());
  const [rates, setRates] = useState<Map<string, RateByDate>>(new Map());
  const [invStatus, setInvStatus] = useState<"loading" | "ready" | "error">("loading");
  const [invToken, setInvToken] = useState(0);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<{ roomId: string; message: string } | null>(null);

  const roomIdsKey = ctx.rooms.map((r) => r.id).join(",");
  useEffect(() => {
    if (ctx.status !== "ready") return;
    if (!roomIdsKey || nights.length === 0) {
      setInvStatus("ready");
      return;
    }
    let cancelled = false;
    setInvStatus("loading");
    getInventory(supabase, { roomIds: roomIdsKey.split(","), from: nights[0], to: nights[nights.length - 1] })
      .then(({ inventory: inv, rates: rt }) => {
        if (cancelled) return;
        setInventory(inv);
        setRates(rt);
        setInvStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setInvStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [ctx.status, roomIdsKey, nights, invToken]);

  if (!draft || ctx.status === "missing") {
    return (
      <Shell>
        <StateBlock icon={SearchX} title="Séjour non défini" message="Reprenez votre recherche pour choisir vos dates." action={{ label: "Retour à la recherche", href: "/hotels" }} />
      </Shell>
    );
  }

  const dateProblem = today ? validateStayDates({ checkIn: draft.checkIn, checkOut: draft.checkOut, today }) : null;
  if (dateProblem) {
    return (
      <Shell>
        <StateBlock icon={CalendarX} title="Dates à revoir" message={dateProblem} action={{ label: "Modifier mes dates", href: hotelHref(draft.hotelId) }} />
      </Shell>
    );
  }

  if (ctx.status === "not_found") {
    return (
      <Shell>
        <StateBlock icon={SearchX} title="Cet hôtel n'est plus disponible" message="Il a peut-être été retiré du catalogue." action={{ label: "Voir les hôtels", href: "/hotels" }} />
      </Shell>
    );
  }
  if (ctx.status === "error") {
    return (
      <Shell>
        <StateBlock icon={WifiOff} tone="error" title="Connexion interrompue" message="Les chambres n'ont pas pu être chargées." action={{ label: "Réessayer", onClick: ctx.reload }} />
      </Shell>
    );
  }
  if (ctx.status === "loading" || !ctx.hotel) {
    return (
      <Shell>
        <BlockSkeleton lines={3} />
        <div className="mt-4"><BlockSkeleton lines={5} /></div>
      </Shell>
    );
  }

  const hotel = ctx.hotel;
  const d = draft;

  function evaluate(room: HotelRoom) {
    const byDate = inventory.get(room.id) ?? {};
    const fits = fitsCapacity({ room, adults: d.adults, children: d.children, roomsCount: d.rooms });
    const available = fits ? minAvailableAcrossNights({ nights, inventoryByDate: byDate }) : 0;
    const blocked = fits ? firstUnavailableNight({ nights, inventoryByDate: byDate, roomsWanted: d.rooms }) : null;
    const isAvailable = fits && available >= d.rooms;
    const subtotal = previewRoomSubtotal({ nights, rateByDate: rates.get(room.id) ?? {}, basePrice: room.basePrice, roomsCount: d.rooms });
    const perNight = nights.length ? subtotal / nights.length / d.rooms : room.basePrice;
    return { fits, available, blocked, isAvailable, perNight };
  }

  const evaluated = ctx.rooms.map((room) => ({ room, ...evaluate(room) }));
  // Les chambres disponibles remontent en tête, puis par tarif.
  evaluated.sort((a, b) => (a.isAvailable !== b.isAvailable ? (a.isAvailable ? -1 : 1) : a.room.basePrice - b.room.basePrice));
  const anyAvailable = evaluated.some((e) => e.isAvailable);

  async function onSelect(room: HotelRoom) {
    if (selecting) return;
    setSelecting(room.id);
    setRoomError(null);
    const quote = await requestQuote(supabase, {
      roomId: room.id,
      checkIn: d.checkIn,
      checkOut: d.checkOut,
      adults: d.adults,
      children: d.children,
      roomsCount: d.rooms,
      serviceIds: d.serviceIds,
    });
    if (!quote.ok) {
      setSelecting(null);
      setRoomError({ roomId: room.id, message: HOTEL_ERROR_MESSAGES[quote.error] });
      if (quote.error === "room_unavailable") setInvToken((t) => t + 1);
      return;
    }
    if (!quote.isAvailable) {
      // Le devis est valide mais l'inventaire ne suit pas : on BLOQUE et on rafraîchit.
      setSelecting(null);
      setRoomError({ roomId: room.id, message: QUOTE_UNAVAILABLE_MESSAGE });
      setInvToken((t) => t + 1);
      return;
    }
    router.push(draftHref("services", d, { roomId: room.id }));
  }

  return (
    <Shell hotelName={hotel.name} hotelId={hotel.id}>
      <BookingSteps current={1} />
      <h1 className="mb-4 text-2xl font-black text-slate-950">Choisissez votre chambre</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {ctx.rooms.length === 0 ? (
            <StateBlock icon={BedDouble} title="Aucune chambre publiée" message="Cet établissement n'a pas encore mis de chambre en ligne." action={{ label: "Retour à la fiche", href: hotelHref(hotel.id) }} />
          ) : invStatus === "error" ? (
            <StateBlock icon={WifiOff} tone="error" title="Disponibilités indisponibles" message="L'inventaire n'a pas pu être chargé." action={{ label: "Réessayer", onClick: () => setInvToken((t) => t + 1) }} />
          ) : invStatus === "loading" ? (
            <BlockSkeleton lines={5} />
          ) : (
            <>
              {!anyAvailable ? (
                <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800" role="status">
                  <CalendarX className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                  Aucune chambre disponible sur toutes les nuits de votre séjour. Essayez d&apos;autres dates.
                </div>
              ) : null}
              {evaluated.map(({ room, fits, available, blocked, isAvailable, perNight }) => {
                const scarce = isAvailable && available <= 2;
                return (
                  <article
                    key={room.id}
                    className={cn("overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm", !isAvailable && "opacity-60")}
                  >
                    <div className="flex flex-col sm:flex-row">
                      <HotelImg src={room.photos[0] ?? ""} alt={room.name} className="h-44 w-full shrink-0 sm:h-auto sm:w-56" />
                      <div className="flex flex-1 flex-col gap-2 p-4">
                        <h2 className="text-lg font-black text-slate-950">{room.name}</h2>
                        <p className="text-sm text-slate-500">{roomSummaryLabel(room)}</p>
                        {room.description.trim() ? <p className="line-clamp-3 text-sm text-slate-600">{room.description.trim()}</p> : null}
                        <p
                          className={cn(
                            "flex items-center gap-1.5 text-xs font-bold",
                            !isAvailable ? "text-red-600" : scarce ? "text-orange-600" : "text-emerald-700",
                          )}
                        >
                          {!isAvailable ? (
                            <>
                              <CalendarX className="h-4 w-4" aria-hidden />
                              {!fits
                                ? "Capacité insuffisante pour votre groupe"
                                : blocked
                                  ? `Complet le ${dayMonthLabel(blocked)}`
                                  : "Indisponible pour ces dates"}
                            </>
                          ) : scarce ? (
                            <>
                              <Flame className="h-4 w-4" aria-hidden /> Plus que {available} chambre{available > 1 ? "s" : ""} à ce prix
                            </>
                          ) : (
                            <>
                              <CircleCheck className="h-4 w-4" aria-hidden /> Disponible
                            </>
                          )}
                        </p>
                        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-2">
                          <div>
                            <p className="text-lg font-black text-slate-950">
                              {money(perNight, room.currency, hotel.countryId)}
                              <span className="ml-1 text-xs font-semibold text-slate-500">/ nuit</span>
                            </p>
                            <p className="text-xs text-slate-500">Prix indicatif — le total exact s&apos;affiche à l&apos;étape suivante.</p>
                          </div>
                          <Button type="button" disabled={!isAvailable || selecting !== null} onClick={() => onSelect(room)}>
                            {selecting === room.id ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
                            {isAvailable ? "Choisir" : "Complet"}
                          </Button>
                        </div>
                        {roomError?.roomId === room.id ? (
                          <p role="alert" className="text-sm font-semibold text-red-600">
                            {roomError.message}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </>
          )}
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <StaySummary hotel={hotel} draft={d} />
          <Link href={hotelHref(hotel.id, { checkIn: d.checkIn, checkOut: d.checkOut, rooms: d.rooms, adults: d.adults, children: d.children })} className="mt-3 inline-block text-sm font-bold text-[#009688] hover:underline">
            Modifier les dates ou les voyageurs
          </Link>
        </aside>
      </div>
    </Shell>
  );
}

function Shell({ children, hotelName, hotelId }: { children: React.ReactNode; hotelName?: string; hotelId?: string }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
      <Breadcrumbs
        items={[
          { label: "Hôtels", href: "/hotels" },
          ...(hotelName && hotelId ? [{ label: hotelName, href: hotelHref(hotelId) }] : []),
          { label: "Chambres" },
        ]}
      />
      {children}
    </main>
  );
}
