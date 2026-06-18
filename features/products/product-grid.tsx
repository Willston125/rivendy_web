import { ProductCard } from "@/features/products/product-card";
import { AdCardInline } from "@/features/ads/ad-card-inline";
import type { Country, Product, Advertisement } from "@/types/rivendy";

export function ProductGrid({
  products,
  country,
  emptyLabel = "Aucun produit disponible pour ce filtre.",
  cols = 4,
  inlineAds = [],
}: {
  products: Product[];
  country?: Country | null;
  emptyLabel?: string;
  /** Nombre max de colonnes sur grand écran (default 4) */
  cols?: 3 | 4;
  /** Affiches pub insérées comme cellules dans la grille (1 toutes les 12 produits) */
  inlineAds?: Advertisement[];
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

  // Construire la liste mixte : 1 carte pub toutes les 12 produits
  type GridItem =
    | { type: "product"; data: Product }
    | { type: "ad"; data: Advertisement; key: string };

  const mixed: GridItem[] = [];
  let sinceAd = 0;
  let adIdx = 0;

  for (const product of products) {
    mixed.push({ type: "product", data: product });
    sinceAd++;
    if (inlineAds.length > 0 && sinceAd >= 12) {
      const ad = inlineAds[adIdx % inlineAds.length];
      mixed.push({ type: "ad", data: ad, key: `ad-${ad.id}-${adIdx}` });
      adIdx++;
      sinceAd = 0;
    }
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
      {mixed.map((item) =>
        item.type === "product" ? (
          <ProductCard key={item.data.id} product={item.data} country={country} />
        ) : (
          <AdCardInline key={item.key} ad={item.data} />
        )
      )}
    </div>
  );
}
