"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, LayoutGrid, List } from "lucide-react";
import type { Country, Product } from "@/types/rivendy";
import { ProductGrid } from "@/features/products/product-grid";
import { ProductCardAction, ProductCardFavorite } from "@/features/products/product-card-action";
import { categoryLabel, firstPhoto, formatMoney } from "@/lib/utils/format";
import { distinctCategories } from "@/features/store/store-helpers";
import { useStoreBrowse } from "@/features/store/store-browse-context";

export function StoreCatalog({
  products,
  country,
}: {
  products: Product[];
  country: Country;
}) {
  const { query, setQuery, category, setCategory, sort, setSort, view, setView, showFilters } = useStoreBrowse();

  const cats = useMemo(() => distinctCategories(products), [products]);

  const filtered = useMemo(() => {
    let list = products;
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((p) => p.title.toLowerCase().includes(q));
    if (category !== "all") list = list.filter((p) => String(p.category) === category);

    const sorted = [...list];
    if (sort === "price_asc") sorted.sort((a, b) => a.price - b.price);
    else if (sort === "price_desc") sorted.sort((a, b) => b.price - a.price);
    else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sorted;
  }, [products, query, category, sort]);

  return (
    <div className="space-y-4">
      {/* Barre d'outils : tri + bascule vue (la recherche est dans la nav en desktop) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Recherche — visible uniquement en mobile (en desktop elle est dans la nav) */}
        <div className="relative lg:hidden">
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

        <div className="ml-auto flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            aria-label="Trier les produits"
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#009688]"
          >
            <option value="recent">Plus récent</option>
            <option value="price_asc">Prix croissant</option>
            <option value="price_desc">Prix décroissant</option>
          </select>

          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-label="Vue grille"
              className={`grid h-9 w-9 place-items-center rounded-lg transition ${
                view === "grid" ? "bg-[#009688] text-white" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-label="Vue liste"
              className={`grid h-9 w-9 place-items-center rounded-lg transition ${
                view === "list" ? "bg-[#009688] text-white" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Chips catégories — révélées par le bouton « Filtres » de la nav */}
      {showFilters && cats.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              category === "all" ? "bg-[#009688] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Toutes catégories
          </button>
          {cats.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                category === c ? "bg-[#009688] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {categoryLabel(c)}
            </button>
          ))}
        </div>
      )}

      {/* Vue grille ou liste */}
      {view === "grid" ? (
        <ProductGrid
          products={filtered}
          country={country}
          cols={4}
          emptyLabel="Aucun produit ne correspond à votre recherche."
        />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <p className="font-semibold text-slate-600">Aucun produit ne correspond à votre recherche.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm transition hover:border-slate-200 hover:shadow-md"
            >
              <Link
                href={`/products/${p.id}`}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100"
              >
                <Image src={firstPhoto(p)} alt={p.title} fill sizes="80px" className="object-cover" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/products/${p.id}`}
                  className="line-clamp-1 text-sm font-bold text-[#1A1A1A] hover:text-[#009688]"
                >
                  {p.title}
                </Link>
                <p className="mt-0.5 text-[11px] font-medium text-slate-400">{categoryLabel(p.category)}</p>
                <p className="mt-1 text-sm font-black text-[#009688]">{formatMoney(p.price, country)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ProductCardFavorite productId={p.id} sellerId={p.seller_id} />
                <div className="hidden sm:block">
                  <ProductCardAction product={p} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
