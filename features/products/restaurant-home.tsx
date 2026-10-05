"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, X, Medal, Clock, Flame, Utensils } from "lucide-react";
import {
  filterRestaurantGroupsByQuery,
  type RestaurantGroup,
} from "@/features/products/restaurant-grouping";
import { RestaurantEstablishmentCard } from "@/features/products/restaurant-establishment-card";
import type { StoreRatingSummary } from "@/services/public-data";
import type { Country, Product } from "@/types/rivendy";
import { firstPhoto, formatMoney } from "@/lib/utils/format";

/**
 * Accueil Restaurant (client) : recherche « restaurant ou plat » + en-tête
 * « Restaurants recommandés » + grille de cartes. Les chips de type restent
 * gérées en SSR (liens resType) par app/page.tsx.
 *
 * Vue par défaut (aucun filtre, aucune recherche) : rangées « Ouverts
 * maintenant » et « Promotions du moment », comme `RestaurantLandingView`
 * de l'app (audit de parité du 2026-10-04). Les deux listes sont calculées
 * côté serveur (heure et boost), comme le statut Ouvert/Fermé de la carte.
 */
export function RestaurantHome({
  groups,
  ratings,
  banners = {},
  openIds = [],
  showRows = false,
  promoDishes = [],
  country,
}: {
  groups: RestaurantGroup[];
  ratings: Record<string, StoreRatingSummary>;
  /** seller_id → bannière boutique (prime sur la photo de plat). */
  banners?: Record<string, string>;
  /** seller_id des restaurants ouverts, à l'heure locale du marché. */
  openIds?: string[];
  /** Vue par défaut (aucun filtre de type) : rangées de l'app. */
  showRows?: boolean;
  /** Plats en promotion (boostés ou attribut promo/remise), 10 au plus. */
  promoDishes?: Product[];
  country?: Country | null;
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () => filterRestaurantGroupsByQuery(groups, query),
    [groups, query],
  );
  const openSet = useMemo(() => new Set(openIds), [openIds]);
  const openNow = useMemo(
    () => groups.filter((g) => openSet.has(g.sellerId)),
    [groups, openSet],
  );
  const rowsVisible = showRows && query.trim() === "";
  const countryParam = country?.id ? `?country=${country.id}` : "";

  return (
    <section>
      {/* Recherche contextuelle */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un restaurant, un plat…"
          className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-[13.5px] font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#009688] focus:outline-none focus:ring-2 focus:ring-[#009688]/15"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Effacer la recherche"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Ouverts maintenant */}
      {rowsVisible && openNow.length > 0 && (
        <div className="mb-5">
          <div className="mb-2.5 flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#009688]" />
            <h2 className="text-[15px] font-black text-slate-900">Ouverts maintenant</h2>
          </div>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {openNow.map((g) => {
              const cover = (banners[g.sellerId] ?? "").trim() || g.coverUrl;
              return (
                <Link
                  key={g.sellerId}
                  href={`/restaurant/${g.sellerId}${countryParam}`}
                  className="flex w-56 shrink-0 items-center gap-3 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm transition hover:shadow-md"
                >
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#E0F2F1]">
                    {cover ? (
                      <Image src={cover} alt={g.sellerName} fill sizes="48px" className="object-cover" />
                    ) : (
                      <Utensils className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-[#009688]" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold text-slate-900">{g.sellerName}</span>
                    <span className="block truncate text-[11.5px] text-slate-500">{g.openingHours}</span>
                    <span className="mt-0.5 inline-block rounded-full bg-emerald-50 px-1.5 text-[10.5px] font-bold text-emerald-700">
                      Ouvert
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Promotions du moment */}
      {rowsVisible && promoDishes.length > 0 && (
        <div className="mb-5">
          <div className="mb-2.5 flex items-center gap-2">
            <Flame className="h-4 w-4 text-[#FF6B35]" />
            <h2 className="text-[15px] font-black text-slate-900">Promotions du moment</h2>
          </div>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {promoDishes.map((p) => {
              const photo = firstPhoto(p);
              return (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="w-40 shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md"
                >
                  <span className="relative block h-28 w-full bg-[#E0F2F1]">
                    {photo ? (
                      <Image src={photo} alt={p.title} fill sizes="160px" className="object-cover" />
                    ) : (
                      <Utensils className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-[#009688]" />
                    )}
                    <span className="absolute left-2 top-2 rounded-full bg-[#FF6B35] px-2 py-0.5 text-[10.5px] font-bold text-white">
                      Promo
                    </span>
                  </span>
                  <span className="block p-2.5">
                    <span className="line-clamp-2 text-[12.5px] font-bold leading-snug text-slate-900">{p.title}</span>
                    <span className="mt-1 block text-[12.5px] font-black text-[#009688]">
                      {formatMoney(p.price, country)}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* En-tête */}
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E0F2F1]">
          <Medal className="h-4 w-4 text-[#009688]" />
        </span>
        <h2 className="text-[16px] font-black text-slate-900">
          Restaurants recommandés
        </h2>
        <span className="rounded-full bg-[#E0F2F1] px-2 py-0.5 text-[11px] font-bold text-[#007168]">
          {visible.length} établissement{visible.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Grille / état vide */}
      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-[13.5px] text-slate-500">
          {query
            ? `Aucun restaurant trouvé pour « ${query} ».`
            : "Aucun restaurant dans cette sélection pour le moment."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((group) => (
            <RestaurantEstablishmentCard
              key={group.sellerId || group.sellerName}
              group={group}
              avgRating={ratings[group.sellerId]?.average}
              ratingCount={ratings[group.sellerId]?.count ?? 0}
              bannerUrl={banners[group.sellerId]}
              isOpen={openSet.has(group.sellerId)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
