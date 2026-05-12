import { ProductCard } from "@/features/products/product-card";
import type { Country, Product } from "@/types/rivendy";

export function ProductGrid({
  products,
  country,
  emptyLabel = "Aucun produit disponible pour ce filtre.",
  cols = 4,
}: {
  products: Product[];
  country?: Country | null;
  emptyLabel?: string;
  /** Nombre max de colonnes sur grand écran (default 4) */
  cols?: 3 | 4;
}) {
  if (!products.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
        <p className="font-semibold text-slate-600">{emptyLabel}</p>
        <p className="mt-1 text-sm text-slate-400">
          Change de catégorie ou de pays pour voir plus d&apos;articles.
        </p>
      </div>
    );
  }

  /* grid-cols selon contexte :
     cols=3 → utilisé dans la colonne centrale (layout 3 colonnes)
     cols=4 → utilisé sur les pages full-width (search, favorites…) */
  const gridClass =
    cols === 3
      ? "grid-cols-2 md:grid-cols-3"
      : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4";

  return (
    <div className={`grid gap-3 ${gridClass}`}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} country={country} />
      ))}
    </div>
  );
}
