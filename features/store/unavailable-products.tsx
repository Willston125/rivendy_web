"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp, Package } from "lucide-react";
import type { Product } from "@/types/rivendy";

const INITIAL_SHOWN = 6;

export function UnavailableProducts({ products }: { products: Product[] }) {
  const [expanded, setExpanded] = useState(false);

  if (products.length === 0) return null;

  const shown = expanded ? products : products.slice(0, INITIAL_SHOWN);
  const hasMore = products.length > INITIAL_SHOWN;

  return (
    <section className="mt-8 space-y-3">
      <h2 className="text-sm font-black text-slate-400 uppercase tracking-wider">
        Archivés
        <span className="ml-1.5 font-bold text-slate-300">({products.length})</span>
      </h2>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((product) => (
          <div
            key={product.id}
            className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 opacity-55"
          >
            {/* Miniature */}
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100 grayscale">
              {Array.isArray(product.photos) && product.photos.length > 0 ? (
                <Image
                  src={product.photos[0] as string}
                  alt={product.title}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center">
                  <Package className="h-5 w-5 text-slate-300" />
                </div>
              )}
            </div>
            {/* Infos */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-600">{product.title}</p>
              <p className="text-xs font-semibold text-slate-400">
                {product.status === "sold" ? "Vendu" : "Épuisé"}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Voir tout / Réduire */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-400 transition hover:text-slate-600"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Réduire
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Voir les {products.length - INITIAL_SHOWN} articles restants
            </>
          )}
        </button>
      )}
    </section>
  );
}
