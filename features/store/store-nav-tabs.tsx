"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useStoreBrowse } from "@/features/store/store-browse-context";

export function StoreNavTabs({
  showFeatured,
}: {
  showFeatured: boolean;
  sellerName?: string;
}) {
  const { query, setQuery, showFilters, setShowFilters } = useStoreBrowse();

  const tabs = [
    { id: "hero", label: "Accueil" },
    { id: "produits", label: "Tous les produits" },
    ...(showFeatured ? [{ id: "nouveautes", label: "Nouveautés" }] : []),
    { id: "avis", label: "Avis" },
    { id: "a-propos", label: "À propos" },
  ];

  const go = (id: string) => {
    if (id === "hero") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const focusCatalog = () => {
    document.getElementById("produits")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav className="sticky top-[110px] z-20 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/95 px-2 py-1.5 shadow-sm backdrop-blur md:top-16">
      {/* Onglets */}
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => go(t.id)}
            className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Recherche + Filtres (desktop) */}
      <div className="hidden shrink-0 items-center gap-2 lg:flex">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={focusCatalog}
            placeholder="Rechercher dans la boutique…"
            aria-label="Rechercher dans la boutique"
            className="h-9 w-56 rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#009688] focus:bg-white xl:w-64"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setShowFilters(!showFilters);
            focusCatalog();
          }}
          className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold transition ${
            showFilters
              ? "border-[#009688] bg-[#E0F2F1] text-[#009688]"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtres
        </button>
      </div>
    </nav>
  );
}
