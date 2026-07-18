"use client";

import { useMemo, useState } from "react";
import { Search, X, Medal } from "lucide-react";
import {
  filterRestaurantGroupsByQuery,
  type RestaurantGroup,
} from "@/features/products/restaurant-grouping";
import { RestaurantEstablishmentCard } from "@/features/products/restaurant-establishment-card";
import type { StoreRatingSummary } from "@/services/public-data";

/**
 * Accueil Restaurant (client) : recherche « restaurant ou plat » + en-tête
 * « Restaurants recommandés » + grille de cartes. Les chips de type restent
 * gérées en SSR (liens resType) par app/page.tsx.
 */
export function RestaurantHome({
  groups,
  ratings,
  banners = {},
}: {
  groups: RestaurantGroup[];
  ratings: Record<string, StoreRatingSummary>;
  /** seller_id → bannière boutique (prime sur la photo de plat). */
  banners?: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () => filterRestaurantGroupsByQuery(groups, query),
    [groups, query],
  );

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
            />
          ))}
        </div>
      )}
    </section>
  );
}
