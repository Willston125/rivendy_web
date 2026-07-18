import Link from "next/link";
import Image from "next/image";
import { Utensils, BadgeCheck, Timer, Flame, ArrowRight, Star } from "lucide-react";
import {
  isRestaurantOpen,
  topDishes,
  type RestaurantGroup,
} from "@/features/products/restaurant-grouping";

/**
 * Carte établissement premium (1 par restaurant) — onglet Restaurant web.
 * Clic → menu du restaurant (/restaurant/[sellerId]). Aucun contact direct.
 * Design mockup 2026-07-17 : logo chevauchant le bandeau, note ⭐ réelle
 * (si avis), chips spécialités. Statut Ouvert/Fermé : heure serveur (SSR).
 */
export function RestaurantEstablishmentCard({
  group,
  avgRating,
  ratingCount = 0,
  bannerUrl,
}: {
  group: RestaurantGroup;
  avgRating?: number;
  ratingCount?: number;
  /** Bannière boutique du restaurateur — prime sur la photo du dernier plat. */
  bannerUrl?: string;
}) {
  const plats = `${group.productCount} ${group.productCount > 1 ? "plats" : "plat"}`;
  const subtitle = [group.cuisine, group.deliveryZone].filter(Boolean).join(" · ");
  const hasHours = group.openingHours.length > 0;
  const isOpen = hasHours && isRestaurantOpen(group.openingHours);
  const dishes = topDishes(group);
  // Couverture effective : bannière boutique > photo de plat > repli icône.
  const cover = (bannerUrl ?? "").trim() || group.coverUrl;

  const inner = (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md">
      {/* Bandeau */}
      <div className="relative h-40 w-full bg-[#E0F2F1]">
        {cover ? (
          <Image
            src={cover}
            alt={group.sellerName}
            fill
            sizes="(max-width: 680px) 100vw, 680px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#009688]">
            <Utensils className="h-9 w-9" />
          </div>
        )}
        {group.hasPromo && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-[#FF6B35] px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
            <Flame className="h-3 w-3" />
            Promo
          </span>
        )}
        {hasHours && (
          <span
            className={`absolute right-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold shadow-sm ${
              isOpen ? "text-[#16A34A]" : "text-slate-500"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${isOpen ? "bg-[#16A34A]" : "bg-slate-400"}`}
            />
            {isOpen ? "Ouvert" : "Fermé"}
          </span>
        )}
        {/* Logo chevauchant le bas du bandeau (signature du design) */}
        <div className="absolute -bottom-6 left-4 rounded-2xl bg-white p-[3px] shadow-md">
          <div className="relative h-[52px] w-[52px] overflow-hidden rounded-xl bg-[#E0F2F1]">
            {group.logoUrl ? (
              <Image
                src={group.logoUrl}
                alt={group.sellerName}
                fill
                sizes="52px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[#009688]">
                <Utensils className="h-5 w-5" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Corps */}
      <div className="p-3.5 pt-8">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate text-[15.5px] font-black text-[#1A1A1A]">
            {group.sellerName}
          </h3>
          {group.isVerified && (
            <BadgeCheck className="h-4 w-4 shrink-0 text-[#009688]" />
          )}
        </div>
        {subtitle && (
          <p className="mt-0.5 truncate text-[12.5px] font-medium text-slate-500">
            {subtitle}
          </p>
        )}

        {/* Ligne méta : ⭐ note (si avis) · plats · prépa */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-semibold text-slate-500">
          {avgRating !== undefined && (
            <>
              <span className="inline-flex items-center gap-1 text-[#1A1A1A]">
                <Star className="h-3.5 w-3.5 fill-[#F59E0B] text-[#F59E0B]" />
                {avgRating.toFixed(1)}
                {ratingCount > 0 && (
                  <span className="font-medium text-slate-400">({ratingCount})</span>
                )}
              </span>
              <span className="text-slate-300">·</span>
            </>
          )}
          <span className="inline-flex items-center gap-1">
            <Utensils className="h-3 w-3" />
            {plats}
          </span>
          {group.prepTime && (
            <>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1">
                <Timer className="h-3 w-3" />
                {group.prepTime}
              </span>
            </>
          )}
        </div>

        {/* Chips spécialités */}
        {dishes.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {dishes.map((d) => (
              <span
                key={d}
                className="max-w-[45%] truncate rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
              >
                {d}
              </span>
            ))}
          </div>
        )}

        {/* Type + CTA */}
        <div className="mt-3 flex items-center justify-between">
          {group.etablissementType ? (
            <span className="rounded-full bg-[#007168] px-2.5 py-1 text-[11px] font-bold text-white">
              {group.etablissementType}
            </span>
          ) : (
            <span />
          )}
          <span className="inline-flex items-center gap-1 rounded-xl bg-[#009688] px-3.5 py-2 text-[12.5px] font-bold text-white">
            Voir le menu
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </article>
  );

  if (!group.sellerId) return <div className="cursor-default opacity-90">{inner}</div>;
  return (
    <Link href={`/restaurant/${group.sellerId}`} className="block">
      {inner}
    </Link>
  );
}
