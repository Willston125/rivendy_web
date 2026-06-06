"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowUpDown, SlidersHorizontal } from "lucide-react";

/**
 * Barre de catalogue : tri + fourchette de prix.
 * Parity Flutter search_screen.dart (_sortOrder + _priceMin/_priceMax).
 * Met à jour les searchParams → la home (server component) re-rend la grille.
 */

const SORTS = [
  { value: "recent", label: "Plus récents" },
  { value: "price_asc", label: "Prix croissant" },
  { value: "price_desc", label: "Prix décroissant" },
] as const;

export function CatalogToolbar({
  resultCount,
  currencySymbol,
}: {
  resultCount: number;
  currencySymbol: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [min, setMin] = useState(params.get("priceMin") ?? "");
  const [max, setMax] = useState(params.get("priceMax") ?? "");
  const sort = params.get("sort") ?? "recent";

  function pushParams(mutate: (p: URLSearchParams) => void) {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    router.push(`/?${next.toString()}`);
  }

  function onSortChange(value: string) {
    pushParams((p) => {
      if (value === "recent") p.delete("sort");
      else p.set("sort", value);
    });
  }

  function applyPrice() {
    pushParams((p) => {
      if (min.trim()) p.set("priceMin", min.trim());
      else p.delete("priceMin");
      if (max.trim()) p.set("priceMax", max.trim());
      else p.delete("priceMax");
    });
  }

  function resetPrice() {
    setMin("");
    setMax("");
    pushParams((p) => {
      p.delete("priceMin");
      p.delete("priceMax");
    });
  }

  const hasPriceFilter = Boolean(params.get("priceMin") || params.get("priceMax"));

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      {/* Nombre de résultats */}
      <p className="px-1 text-sm font-semibold text-slate-500">
        {resultCount} article{resultCount > 1 ? "s" : ""}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {/* Fourchette de prix */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <input
            type="number"
            inputMode="numeric"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyPrice()}
            placeholder="Min"
            className="w-16 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          <span className="text-slate-300">–</span>
          <input
            type="number"
            inputMode="numeric"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyPrice()}
            placeholder="Max"
            className="w-16 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          <span className="text-xs font-semibold text-slate-400">{currencySymbol}</span>
          <button
            type="button"
            onClick={applyPrice}
            className="ml-1 rounded-lg bg-[#009688] px-2.5 py-1 text-xs font-bold text-white transition hover:bg-[#00796B]"
          >
            OK
          </button>
          {hasPriceFilter && (
            <button
              type="button"
              onClick={resetPrice}
              className="text-xs font-semibold text-slate-400 transition hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Tri */}
        <div className="relative flex items-center">
          <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
            className="h-9 cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-8 text-sm font-semibold text-slate-700 outline-none transition hover:border-[#009688] focus:border-[#009688] focus:bg-white"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
