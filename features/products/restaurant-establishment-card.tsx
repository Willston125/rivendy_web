import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Utensils, Bike, BadgeCheck } from "lucide-react";
import type { RestaurantGroup } from "@/features/products/restaurant-grouping";

/**
 * Carte établissement (1 par restaurant) pour l'onglet Restaurant web.
 * Clic → catalogue du restaurant (/store/[sellerId]). Aucun contact direct.
 * Charte Rivendy : #009688 / #007168 + neutres.
 */
export function RestaurantEstablishmentCard({ group }: { group: RestaurantGroup }) {
  const plats = `${group.productCount} ${group.productCount > 1 ? "plats" : "plat"}`;

  const inner = (
    <div className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition hover:shadow-md">
      {/* Logo */}
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#E0F2F1]">
        {group.logoUrl ? (
          <Image
            src={group.logoUrl}
            alt={group.sellerName}
            fill
            sizes="64px"
            className="object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#009688]">
            <Utensils className="h-6 w-6" />
          </div>
        )}
      </div>

      {/* Infos */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate text-sm font-black text-[#1A1A1A]">
            {group.sellerName}
          </h3>
          {group.isVerified && <BadgeCheck className="h-4 w-4 shrink-0 text-[#009688]" />}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {group.etablissementType && (
            <span className="rounded-full bg-[#007168] px-2.5 py-1 text-[11px] font-bold text-white">
              {group.etablissementType}
            </span>
          )}
          {group.cuisine && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
              <Utensils className="h-3 w-3" />
              {group.cuisine}
            </span>
          )}
          {group.hasDelivery && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#E0F2F1] px-2.5 py-1 text-[11px] font-bold text-[#009688]">
              <Bike className="h-3 w-3" />
              Livraison
            </span>
          )}
        </div>

        <span className="text-[12px] font-semibold text-[#007168]">{plats}</span>
      </div>

      <ChevronRight className="h-5 w-5 shrink-0 text-[#009688]" />
    </div>
  );

  if (!group.sellerId) {
    return <div className="cursor-default opacity-90">{inner}</div>;
  }

  return (
    <Link href={`/store/${group.sellerId}`} className="block">
      {inner}
    </Link>
  );
}
