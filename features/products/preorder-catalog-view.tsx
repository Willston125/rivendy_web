"use client";

import { useEffect, useState } from "react";
import { Search, X, Info, Package, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCountryOrDefault } from "@/features/country/country-provider";
import { firstPhoto, formatMoney } from "@/lib/utils/format";
import { supabase } from "@/lib/supabase/client";
import type { Product } from "@/types/rivendy";

export function PreorderCatalogView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("product_type", "preorder")
        .in("status", ["active", "boosted"])
        .order("created_at", { ascending: false });
      setProducts((data as Product[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = search.trim()
    ? products.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.description.toLowerCase().includes(search.toLowerCase())
      )
    : products;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white px-4 pb-3 pt-4 shadow-sm md:px-6">
        <div className="mb-1">
          <p className="text-xs font-black uppercase tracking-wider text-[#009688]">Rivendy</p>
          <h1 className="text-xl font-black text-[#1A1A1A]">
            Disponible par Commande
          </h1>
          <p className="text-xs text-slate-400">Produits importés par Rivendy</p>
        </div>

        {/* Search */}
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")}>
              <X className="h-4 w-4 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-4 md:px-6">
        {/* Info banner */}
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-[#009688]/20 bg-[#009688]/8 bg-[#E8F5E9] px-4 py-3">
          <Info className="h-4 w-4 shrink-0 text-[#009688]" />
          <p className="text-xs leading-relaxed text-[#009688]">
            Ces produits sont commandés et importés par Rivendy après votre
            paiement.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#009688] border-t-transparent" />
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="h-16 w-16 text-slate-200" />
            <p className="mt-4 text-base font-semibold text-slate-500">
              {search
                ? `Aucun résultat pour "${search}"`
                : "Aucun produit disponible\npour le moment"}
            </p>
          </div>
        )}

        {/* Grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {filtered.map((product) => (
              <PreorderCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PreorderCard({ product }: { product: Product }) {
  const country = useCountryOrDefault();

  return (
    <Link
      href={`/products/${product.id}`}
      className="group overflow-hidden rounded-2xl bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-square bg-slate-100">
        <Image
          src={firstPhoto(product)}
          alt={product.title}
          fill
          className="object-cover transition duration-300 group-hover:scale-105"
        />
        <div className="absolute left-2 top-2 rounded-lg bg-[#009688] px-2 py-1">
          <span className="text-[9px] font-bold text-white">Sur commande</span>
        </div>
      </div>

      <div className="p-3">
        <p className="truncate text-sm font-bold text-[#1A1A1A]">
          {product.title}
        </p>
        <p className="mt-0.5 text-base font-black text-[#009688]">
          {formatMoney(product.price, country)}
        </p>
        {/* Delivery time */}
        <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-1">
          <Clock className="h-3 w-3 text-orange-500" />
          <span className="text-[11px] font-bold text-orange-500">
            {product.delivery_days != null
              ? `${product.delivery_days} jours`
              : "Délai à confirmer"}
          </span>
        </div>
      </div>
    </Link>
  );
}
