"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import type { Country, Product } from "@/types/rivendy";
import { ProductGrid } from "@/features/products/product-grid";
import { categoryLabel } from "@/lib/utils/format";
import { distinctCategories } from "@/features/store/store-helpers";

type Sort = "recent" | "price_asc" | "price_desc";

export function StoreCatalog({
  products,
  country,
}: {
  products: Product[];
  country: Country;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [cat, setCat] = useState<string>("all");

  const cats = useMemo(() => distinctCategories(products), [products]);

  const filtered = useMemo(() => {
    let list = products;
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((p) => p.title.toLowerCase().includes(q));
    if (cat !== "all") list = list.filter((p) => String(p.category) === cat);

    const sorted = [...list];
    if (sort === "price_asc") sorted.sort((a, b) => a.price - b.price);
    else if (sort === "price_desc") sorted.sort((a, b) => b.price - a.price);
    else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sorted;
  }, [products, query, cat, sort]);

  return (
    <div className="space-y-4">
      {/* Barre d'outils */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher dans la boutique…"
            aria-label="Rechercher dans la boutique"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#009688] focus:bg-white"
          />
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          {cats.length > 1 && (
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              aria-label="Filtrer par catégorie"
              className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#009688] sm:flex-none"
            >
              <option value="all">Toutes catégories</option>
              {cats.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          )}
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Trier les produits"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#009688]"
            >
              <option value="recent">Plus récent</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix décroissant</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grille (réutilise le composant existant) */}
      <ProductGrid
        products={filtered}
        country={country}
        cols={4}
        emptyLabel="Aucun produit ne correspond à votre recherche."
      />
    </div>
  );
}
