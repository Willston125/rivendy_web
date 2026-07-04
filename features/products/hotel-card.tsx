import Image from "next/image";
import Link from "next/link";
import { MapPin, BadgeCheck, ArrowRight, Utensils } from "lucide-react";
import type { Country } from "@/types/rivendy";
import { formatMoney } from "@/lib/utils/format";
import type { HotelSummary } from "./hotel-listings";

/**
 * Carte hôtel premium (hôtel = vendeur). Clic → /hotel/[id] (page hôtel
 * dédiée : chambres + réservation via l'agence). Aucun contact direct.
 * Charte Rivendy.
 */
export function HotelCard({ hotel, country }: { hotel: HotelSummary; country: Country }) {
  const priceText = hotel.minPrice > 0 ? `À partir de ${formatMoney(hotel.minPrice, country)} / nuit` : "";

  const inner = (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md">
      <div className="relative h-40 w-full bg-[#E0F2F1]">
        {hotel.coverUrl ? (
          <Image
            src={hotel.coverUrl}
            alt={hotel.sellerName}
            fill
            sizes="(max-width: 680px) 100vw, 680px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#009688]">
            <Utensils className="h-9 w-9" />
          </div>
        )}
        {hotel.hasPromo && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-[#FF6B35] px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
            Promo
          </span>
        )}
      </div>

      <div className="p-3.5">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate text-[15px] font-black text-[#1A1A1A]">{hotel.sellerName}</h3>
          {hotel.isVerified && <BadgeCheck className="h-4 w-4 shrink-0 text-[#009688]" />}
        </div>
        {hotel.locality && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-slate-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {hotel.locality}
          </p>
        )}
        {hotel.amenities.length > 0 && (
          <p className="mt-1.5 truncate text-[12px] font-medium text-slate-500">
            {hotel.amenities.join(" · ")}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="truncate text-[12.5px] font-black text-[#009688]">{priceText}</span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#009688] px-3 py-2 text-[12px] font-bold text-white">
            Voir les chambres
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </article>
  );

  if (!hotel.sellerId) return <div className="cursor-default opacity-90">{inner}</div>;

  return (
    <Link href={`/hotel/${hotel.sellerId}`} className="block">
      {inner}
    </Link>
  );
}
