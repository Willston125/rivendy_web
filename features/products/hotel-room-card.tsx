import Image from "next/image";
import { BedDouble } from "lucide-react";
import type { Country, Product } from "@/types/rivendy";
import { formatMoney, firstPhoto } from "@/lib/utils/format";
import { hotelRoomPrice } from "./hotel-listings";
import { HotelReservationForm } from "./hotel-reservation-form";

function attr(p: Product, key: string): string {
  const v = p.extra_attributes?.[key];
  return v == null ? "" : String(v).trim();
}

/** Ligne chambre (parité HotelRoomCard Flutter). Pas de panier ni d'achat
 * direct — uniquement une demande de réservation via l'agence Rivendy. */
export function HotelRoomCard({
  room,
  sellerId,
  hotelName,
  country,
}: {
  room: Product;
  sellerId: string;
  hotelName: string;
  country: Country;
}) {
  const capacity = attr(room, "capacite");
  const beds = attr(room, "lits");
  const breakfast = attr(room, "petit_dejeuner");
  const amenities = attr(room, "equipements")
    .split(/[,;/]/)
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, 2);

  const subtitle = [beds, capacity ? `${capacity} pers.` : ""].filter(Boolean).join(" · ");
  const amenitiesLine = [...amenities, breakfast.toLowerCase().startsWith("oui") ? "Petit-déj. inclus" : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mb-3 flex gap-3 rounded-2xl bg-white p-2.5 shadow-sm">
      <div className="relative h-[92px] w-[92px] shrink-0 overflow-hidden rounded-xl bg-[#E0F2F1]">
        {room.photos?.[0] ? (
          <Image src={firstPhoto(room)} alt={room.title} fill sizes="92px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#009688]">
            <BedDouble className="h-6 w-6" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[14.5px] font-black text-slate-900">{room.title || "Chambre"}</h3>
        {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
        {amenitiesLine && <p className="mt-0.5 truncate text-[11.5px] text-slate-500">{amenitiesLine}</p>}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="truncate text-sm font-black text-[#007168]">
            {formatMoney(hotelRoomPrice(room), country)} / nuit
          </span>
          <HotelReservationForm
            sellerId={sellerId}
            hotelName={hotelName}
            room={{ id: room.id, title: room.title }}
            triggerLabel="Réserver / Demander"
            className="shrink-0 rounded-lg bg-[#009688] px-3 py-2 text-[11.5px] font-bold text-white transition hover:bg-[#00897B]"
          />
        </div>
      </div>
    </div>
  );
}
