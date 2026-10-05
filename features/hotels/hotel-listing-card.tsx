"use client";

import Link from "next/link";
import { BadgeCheck, Heart, MapPin } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatRating, ratingLabel } from "@/lib/hotels/labels";
import { hotelCoverUrl, hotelLocationLabel, type HotelListing } from "@/lib/hotels/types";
import { HotelImg, StarRow, useHotelMoney } from "./hotel-ui";

/**
 * Carte d'un hôtel dans une liste. Le prix est un « à partir de » INDICATIF
 * (tarif le plus bas des chambres qui conviennent) — le montant ferme vient
 * du devis serveur, plus loin dans le parcours.
 */
export function HotelListingCard({
  hotel,
  href,
  isFavorite,
  favoritePending,
  onToggleFavorite,
  hasDates,
}: {
  hotel: HotelListing;
  href: string;
  isFavorite: boolean;
  favoritePending: boolean;
  onToggleFavorite: () => void;
  hasDates: boolean;
}) {
  const money = useHotelMoney();
  const location = hotelLocationLabel(hotel);
  const hasRating = hotel.averageRating != null && hotel.reviewCount > 0;

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009688]">
        <div className="relative h-44 w-full overflow-hidden bg-slate-100">
          <HotelImg src={hotelCoverUrl(hotel)} alt={hotel.name} className="h-full w-full transition duration-300 group-hover:scale-[1.03]" />
          {hotel.isVerified ? (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#007168] shadow-sm">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Partenaire Rivendy
            </span>
          ) : null}
        </div>
        <div className="space-y-1.5 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-base font-black text-slate-950">{hotel.name}</h3>
            {hasRating ? (
              <span className="shrink-0 rounded-lg bg-[#009688] px-2 py-1 text-xs font-black text-white" title={ratingLabel(hotel.averageRating!, hotel.reviewCount)}>
                {formatRating(hotel.averageRating!)}
              </span>
            ) : (
              <span className="shrink-0 rounded-lg bg-[#E0F2F1] px-2 py-1 text-[11px] font-bold text-[#007168]">Nouveau</span>
            )}
          </div>
          <StarRow count={hotel.starRating} />
          {location ? (
            <p className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{location}</span>
            </p>
          ) : null}
          {hasRating ? (
            <p className="text-xs text-slate-500">
              {ratingLabel(hotel.averageRating!, hotel.reviewCount)} · {hotel.reviewCount} avis
            </p>
          ) : null}
          <div className="pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">À partir de</p>
            <p className="text-lg font-black text-slate-950">
              {money(hotel.minPrice, hotel.currency, hotel.countryId)}
              <span className="ml-1 text-xs font-semibold text-slate-500">/ nuit{hasDates ? "" : " · tarif de référence"}</span>
            </p>
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={onToggleFavorite}
        disabled={favoritePending}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? `Retirer ${hotel.name} des favoris` : `Ajouter ${hotel.name} aux favoris`}
        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-sm transition hover:bg-white disabled:opacity-60"
      >
        <Heart className={cn("h-5 w-5", isFavorite ? "fill-red-500 text-red-500" : "text-slate-700")} aria-hidden />
      </button>
    </article>
  );
}
