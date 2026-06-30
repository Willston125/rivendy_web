"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, ShoppingBag } from "lucide-react";
import { ProductGrid } from "@/features/products/product-grid";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountryOrDefault } from "@/features/country/country-provider";
import type { Product } from "@/types/rivendy";

/* ── Squelette de chargement ─────────────────────────────────────── */
function FavoritesSkeleton() {
  

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
        >
          <div className="aspect-square bg-slate-100" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-3/4 rounded-full bg-slate-100" />
            <div className="h-3 w-1/2 rounded-full bg-slate-100" />
            <div className="mt-3 h-8 rounded-xl bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── État vide ───────────────────────────────────────────────────── */
function FavoritesEmpty() {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      {/* Icône */}
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FFF0F0]">
        <Heart className="h-9 w-9 text-red-300" />
      </span>

      <h2 className="mt-5 text-xl font-black text-slate-900">Aucun favori pour l&apos;instant</h2>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
        Appuie sur le cœur ❤️ d&apos;un produit pour le retrouver ici rapidement.
      </p>

      <Link
        href="/"
        className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-[#009688] px-8 text-sm font-black text-white shadow-sm shadow-[#009688]/20 transition hover:bg-[#00796B]"
      >
        <ShoppingBag className="h-4 w-4" />
        Explorer les produits
      </Link>
    </div>
  );
}

/* ── Composant principal ─────────────────────────────────────────── */
export function FavoritesView() {
  const { user } = useAuth();
  const countryNullable = useCountryOrDefault();
  const country = countryNullable as any;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) return;
      setLoading(true);
      const { data } = await supabase
        .from("favorites")
        .select("products(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setProducts(
        ((data ?? []) as unknown as Array<{ products: Product | null }>)
          .map((row) => row.products)
          .filter(Boolean) as Product[],
      );
      setLoading(false);
    }
    load();
  }, [user]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">

      {/* En-tête */}
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Heart className="h-6 w-6 fill-red-400 text-red-400" />
            <h1 className="text-3xl font-black text-slate-900 md:text-4xl">Mes favoris</h1>
          </div>
          <p className="mt-1.5 text-sm text-slate-500">
            {loading
              ? "Chargement…"
              : products.length > 0
              ? `${products.length} article${products.length > 1 ? "s" : ""} sauvegardé${products.length > 1 ? "s" : ""}`
              : "Aucun article sauvegardé"}
          </p>
        </div>

        {/* Lien Explorer */}
        {!loading && products.length > 0 && (
          <Link
            href="/"
            className="shrink-0 text-sm font-bold text-[#009688] transition hover:underline"
          >
            Continuer mes achats →
          </Link>
        )}
      </div>

      {/* Contenu */}
      {loading ? (
        <FavoritesSkeleton />
      ) : products.length === 0 ? (
        <FavoritesEmpty />
      ) : (
        <ProductGrid
          products={products}
          country={country}
          cols={4}
          emptyLabel="Aucun produit sauvegardé."
        />
      )}
    </div>
  );
}
