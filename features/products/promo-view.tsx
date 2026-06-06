"use client";

import { useEffect, useState } from "react";
import { Tag } from "lucide-react";
import { useCountryOrDefault } from "@/features/country/country-provider";
import { ProductCard } from "@/features/products/product-card";
import { supabase } from "@/lib/supabase/client";
import type { Product } from "@/types/rivendy";

export function PromoView() {
  const country = useCountryOrDefault();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Priorité aux produits boostés, sinon tous les produits actifs
      const { data: boosted } = await supabase
        .from("products")
        .select("*")
        .eq("status", "boosted")
        .order("created_at", { ascending: false })
        .limit(40);

      if (boosted && boosted.length > 0) {
        setProducts(boosted as Product[]);
      } else {
        const { data: all } = await supabase
          .from("products")
          .select("*")
          .in("status", ["active", "boosted"])
          .order("created_at", { ascending: false })
          .limit(40);
        setProducts((all as Product[]) ?? []);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      {/* Header */}
      <div className="mb-6 rounded-3xl bg-gradient-to-br from-[#009688] to-[#004D40] px-6 py-8 text-center text-white shadow-xl shadow-[#007168]/20">
        <h1 className="text-2xl font-black">Offres Exclusives ✨</h1>
        <p className="mt-2 text-sm text-white/70">
          Les meilleures affaires sélectionnées par Rivendy
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#009688] border-t-transparent" />
        </div>
      )}

      {/* Empty */}
      {!loading && products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Tag className="h-16 w-16 text-slate-200" />
          <p className="mt-4 text-base font-semibold leading-relaxed text-slate-500">
            Aucune offre disponible
            <br />
            pour le moment
          </p>
        </div>
      )}

      {/* Grid */}
      {!loading && products.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} country={country} />
          ))}
        </div>
      )}
    </div>
  );
}
