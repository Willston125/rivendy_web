"use client";

import { useMemo, useState } from "react";
import { Search, X, Heart } from "lucide-react";
import { searchWeddingOffers } from "@/features/products/wedding-listings";
import { WeddingOfferCard } from "@/features/products/wedding-offer-card";
import type { Product, Country } from "@/types/rivendy";

/**
 * Accueil Mariage (client) : recherche « salle, déco, traiteur… » +
 * en-tête « Prestataires recommandés » + grille de cartes. Les chips de
 * type restent gérées en SSR (liens wedType) par app/page.tsx. Le bloc
 * bannière pub dashboard au-dessus reste INTOUCHÉ (mécanisme générique).
 */
export function WeddingHome({
  offers,
  country,
}: {
  offers: Product[];
  country: Country;
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () => searchWeddingOffers(offers, query),
    [offers, query],
  );

  return (
    <section>
      {/* Recherche contextuelle */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher salle, déco, traiteur…"
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
          <Heart className="h-4 w-4 text-[#009688]" />
        </span>
        <h2 className="text-[16px] font-black text-slate-900">
          Prestataires recommandés
        </h2>
        <span className="rounded-full bg-[#E0F2F1] px-2 py-0.5 text-[11px] font-bold text-[#007168]">
          {visible.length} prestataire{visible.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Grille / état vide */}
      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-[13.5px] text-slate-500">
          {query
            ? `Aucun prestataire trouvé pour « ${query} ».`
            : "Aucun prestataire dans cette sélection pour le moment."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {visible.map((p) => (
            <WeddingOfferCard key={p.id} product={p} country={country} />
          ))}
        </div>
      )}
    </section>
  );
}
