"use client";

import { BedDouble, CalendarDays, MapPin, Users } from "lucide-react";
import { guestsLabel, nightsLabel, rangeLabel } from "@/lib/hotels/dates";
import { nightCount } from "@/lib/hotels/availability";
import { hotelCoverUrl, hotelLocationLabel, type Hotel, type HotelQuote, type HotelRoom } from "@/lib/hotels/types";
import type { BookingDraft } from "@/lib/hotels/search-params";
import { HotelImg, useHotelMoney } from "./hotel-ui";

/** Rappel du séjour en cours (hôtel, dates, chambre, voyageurs). */
export function StaySummary({ hotel, draft, room }: { hotel: Hotel; draft: BookingDraft; room?: HotelRoom | null }) {
  const nights = nightCount(draft.checkIn, draft.checkOut);
  const location = hotelLocationLabel(hotel);
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Votre séjour">
      <div className="flex gap-3">
        <HotelImg src={hotelCoverUrl(hotel)} alt="" className="h-16 w-20 shrink-0 rounded-2xl" />
        <div className="min-w-0">
          <p className="truncate text-base font-black text-slate-950">{hotel.name}</p>
          {location ? (
            <p className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden /> <span className="truncate">{location}</span>
            </p>
          ) : null}
        </div>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
        <li className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[#009688]" aria-hidden />
          {rangeLabel(draft.checkIn, draft.checkOut)} · {nightsLabel(nights)}
          <span className="text-xs text-slate-500">· arrivée dès {hotel.checkInTime}, départ avant {hotel.checkOutTime}</span>
        </li>
        <li className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[#009688]" aria-hidden />
          {guestsLabel(draft.adults, draft.children, draft.rooms)}
        </li>
        {room ? (
          <li className="flex items-center gap-2">
            <BedDouble className="h-4 w-4 text-[#009688]" aria-hidden />
            {room.name}
          </li>
        ) : null}
      </ul>
    </section>
  );
}

/**
 * Détail du prix — RECOPIE du devis serveur, ligne par ligne.
 *
 * ⚠️ Aucun calcul local : si le total ne correspond pas à la somme visible
 * des lignes, c'est le serveur qu'il faut corriger.
 * ⚠️ La commission Rivendy n'est JAMAIS affichée au voyageur.
 */
export function PriceSummary({ quote, countryId }: { quote: Extract<HotelQuote, { ok: true }>; countryId: string }) {
  const money = useHotelMoney();
  const m = (n: number) => money(n, quote.currency, countryId);
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="h-price">
      <h2 id="h-price" className="text-lg font-black text-slate-950">Détail du prix</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-600">
            Chambre · {nightsLabel(quote.nights)}
            {quote.roomsCount > 1 ? ` · ${quote.roomsCount} chambres` : ""}
          </dt>
          <dd className="font-bold text-slate-900">{m(quote.roomSubtotal)}</dd>
        </div>
        {quote.services.map((s) => (
          <div key={s.serviceId} className="flex justify-between gap-3">
            <dt className="text-slate-600">
              {s.name} <span className="text-xs text-slate-400">({m(s.unitPrice)} × {s.quantity})</span>
            </dt>
            <dd className="font-bold text-slate-900">{m(s.lineTotal)}</dd>
          </div>
        ))}
        {quote.taxesTotal > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-slate-600">Taxes et frais</dt>
            <dd className="font-bold text-slate-900">{m(quote.taxesTotal)}</dd>
          </div>
        ) : null}
        {quote.discountTotal > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-slate-600">Remise</dt>
            <dd className="font-bold text-emerald-700">− {m(quote.discountTotal)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3 border-t border-slate-100 pt-3">
          <dt className="text-base font-black text-slate-950">Total</dt>
          <dd className="text-lg font-black text-slate-950">{m(quote.totalAmount)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-slate-500">Montant calculé par Rivendy pour ce séjour.</p>
    </section>
  );
}
