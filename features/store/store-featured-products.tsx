import { Sparkles } from "lucide-react";
import type { Country, Product } from "@/types/rivendy";
import { ProductCard } from "@/features/products/product-card";

export function StoreFeaturedProducts({
  products,
  country,
}: {
  products: Product[];
  country: Country;
}) {
  if (products.length === 0) return null;

  return (
    <section id="nouveautes" className="mt-8 scroll-mt-24">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#FFF3ED] text-[#FF6B35]">
          <Sparkles className="h-4 w-4" />
        </span>
        <h2 className="text-xl font-black text-slate-900">Sélection de la boutique</h2>
      </div>

      {/* Défilement horizontal fluide sur mobile, grille sur desktop */}
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 xl:grid-cols-4">
        {products.map((p) => (
          <div key={p.id} className="w-44 shrink-0 snap-start sm:w-auto">
            <ProductCard product={p} country={country} />
          </div>
        ))}
      </div>
    </section>
  );
}
