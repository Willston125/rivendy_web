"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useCountryOrDefault } from "@/features/country/country-provider";
import { ProductCard } from "@/features/products/product-card";
import { supabase } from "@/lib/supabase/client";
import { CATEGORIES, SUBCATEGORIES, type CategoryId, type Product } from "@/types/rivendy";
import { cn } from "@/lib/utils/cn";

const CATEGORY_EMOJIS: Record<string, string> = {
  femme: "👗",
  homme: "👔",
  bebeEnfants: "👶",
  electronique: "📱",
  maison: "🏠",
  beauteParfums: "💄",
  artisanatLocal: "🎨",
  materiauxConstruction: "🔨",
  alimentation: "🍽️",
};

export function SearchView() {
  const country = useCountryOrDefault();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const subcategories = category ? SUBCATEGORIES[category] ?? [] : [];

  async function doSearch(q: string, cat: CategoryId | null, sub: string | null) {
    setLoading(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dbQuery: any = supabase
      .from("visible_products")
      .select("*")
      .in("status", ["active", "boosted"])
      .order("status", { ascending: false }) // boosted first
      .order("created_at", { ascending: false })
      .limit(60);

    if (country?.id && country.id !== "all")
      dbQuery = dbQuery.eq("country_id", country.id);
    if (cat) dbQuery = dbQuery.eq("category", cat);
    if (sub?.trim()) dbQuery = dbQuery.eq("subcategory", sub.trim());
    if (q.trim()) dbQuery = dbQuery.ilike("title", `%${q.trim()}%`);

    const { data } = await dbQuery;
    setProducts((data as Product[]) ?? []);
    setSearched(true);
    setLoading(false);
  }

  /* Auto-focus à l'ouverture */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* Recherche déclenchée avec debounce 400 ms */
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!query.trim() && !category) {
      setProducts([]);
      setSearched(false);
      return;
    }

    timerRef.current = setTimeout(() => void doSearch(query, category, subcategory), 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category, subcategory, country?.id]);

  function clearAll() {
    setQuery("");
    setCategory(null);
    setSubcategory(null);
    setProducts([]);
    setSearched(false);
    inputRef.current?.focus();
  }

  const hasFilter = Boolean(query || category);

  return (
    <div className="mx-auto max-w-3xl">

      {/* ── Header fixe ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white px-4 pb-3 pt-4 shadow-sm md:px-6">
        {/* Barre de recherche */}
        <div className="flex items-center gap-3 rounded-2xl bg-[#F5F7FA] px-4 py-3 ring-1 ring-transparent transition focus-within:bg-white focus-within:ring-[#009688]/30">
          <Search className="h-4 w-4 shrink-0 text-[#009688]" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un produit, une boutique..."
            className="flex-1 bg-transparent text-sm text-[#1A1A1A] outline-none placeholder:text-slate-400"
          />
          {hasFilter && (
            <button type="button" onClick={clearAll} aria-label="Effacer">
              <X className="h-4 w-4 text-slate-400 transition hover:text-slate-700" />
            </button>
          )}
        </div>

        {/* Filtres catégories */}
        <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition",
              !category
                ? "border-[#009688]/20 bg-[#E0F2F1] text-[#009688]"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
            )}
          >
            Tout
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCategory(c.id === category ? null : c.id);
                setSubcategory(null);
              }}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition",
                category === c.id
                  ? "border-[#009688]/20 bg-[#E0F2F1] text-[#009688]"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
              )}
            >
              {CATEGORY_EMOJIS[c.id] ?? ""} {c.label}
            </button>
          ))}
        </div>

        {/* Subcatégories (2e niveau) */}
        {category && subcategories.length > 0 && (
          <div className="no-scrollbar mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setSubcategory(null)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition",
                !subcategory
                  ? "bg-[#1A1A1A] text-white"
                  : "border border-slate-200 bg-white text-slate-400 hover:border-slate-300",
              )}
            >
              Tout
            </button>
            {subcategories.map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setSubcategory(sub === subcategory ? null : sub)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition",
                  subcategory === sub
                    ? "bg-[#1A1A1A] text-white"
                    : "border border-slate-200 bg-white text-slate-400 hover:border-slate-300",
                )}
              >
                {sub}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Corps ───────────────────────────────────────────────── */}
      <div className="px-4 py-4 md:px-6">

        {/* Chargement */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#009688] border-t-transparent" />
          </div>
        )}

        {/* État vide — pas encore cherché */}
        {!loading && !searched && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E0F2F1]">
              <Search className="h-8 w-8 text-[#009688]" />
            </div>
            <p className="mt-4 text-base font-black text-slate-700">
              Qu&apos;est-ce que vous cherchez ?
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Tapez un mot-clé ou sélectionnez une catégorie
            </p>
          </div>
        )}

        {/* Aucun résultat */}
        {!loading && searched && products.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-5xl">😕</p>
            <p className="mt-4 text-base font-black text-slate-700">Aucun résultat</p>
            <p className="mt-1 text-sm text-slate-400">
              Essayez un autre mot-clé ou une autre catégorie.
            </p>
            <button
              type="button"
              onClick={clearAll}
              className="mt-4 rounded-full bg-[#009688] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#00796B]"
            >
              Réinitialiser
            </button>
          </div>
        )}

        {/* Résultats */}
        {!loading && products.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400">
              {products.length} résultat{products.length > 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} country={country} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
