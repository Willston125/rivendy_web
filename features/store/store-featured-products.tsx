"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import type { Country, Product } from "@/types/rivendy";
import { ProductCard } from "@/features/products/product-card";

export function StoreFeaturedProducts({
  products,
  country,
}: {
  products: Product[];
  country: Country;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows]);

  if (products.length === 0) return null;

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  // Sans assez de produits pour justifier un carrousel : répartir sur toute la largeur
  const isGridOnly = products.length <= 4;

  return (
    <section id="nouveautes" className="mt-8 scroll-mt-24">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#FFF3ED] text-[#FF6B35]">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-xl font-black text-slate-900">Sélection coup de cœur</h2>
          <p className="mt-0.5 text-xs font-semibold text-slate-400">
            Une sélection des meilleurs produits de cette boutique
          </p>
        </div>
      </div>

      {isGridOnly ? (
        // Peu de produits : grille pleine largeur, pas de zone vide.
        // Nombre de colonnes = nombre de produits (max 4) pour éviter l'espace vide à droite.
        <div
          className={
            products.length === 2
              ? "grid grid-cols-2 gap-3 sm:gap-4"
              : products.length === 3
                ? "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4"
                : "grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
          }
        >
          {products.map((p) => (
            <ProductCard key={p.id} product={p} country={country} />
          ))}
        </div>
      ) : (
        <div className="relative">
          {/* Flèche précédente — sur le bord gauche */}
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            disabled={!canPrev}
            aria-label="Produits précédents"
            className="absolute -left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-0 sm:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div
            ref={trackRef}
            className="flex snap-x gap-3 overflow-x-auto pb-2 no-scrollbar sm:gap-4"
          >
            {products.map((p) => (
              <div key={p.id} className="w-44 shrink-0 snap-start sm:w-[calc(25%-12px)] sm:min-w-[200px]">
                <ProductCard product={p} country={country} />
              </div>
            ))}
          </div>

          {/* Flèche suivante — sur le bord droit */}
          <button
            type="button"
            onClick={() => scrollBy(1)}
            disabled={!canNext}
            aria-label="Produits suivants"
            className="absolute -right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-0 sm:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </section>
  );
}
