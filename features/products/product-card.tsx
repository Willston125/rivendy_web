import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Zap } from "lucide-react";
import { ProductCardAction, ProductCardFavorite } from "@/features/products/product-card-action";
import { categoryLabel, firstPhoto, formatMoney, isBoosted } from "@/lib/utils/format";
import type { Country, Product } from "@/types/rivendy";

export function ProductCard({
  product,
  country,
  compact = false,
}: {
  product: Product;
  country?: Country | null;
  compact?: boolean;
}) {
  const isEpuise =
    product.status === "sold" ||
    product.status === "epuise" ||
    Number(product.stock_quantity ?? 1) === 0;

  const boosted = isBoosted(product);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md">

      {/* ── Image ───────────────────────────────────────────────── */}
      <Link
        href={`/products/${product.id}`}
        className="relative block aspect-square overflow-hidden bg-slate-100"
      >
        <Image
          src={firstPhoto(product)}
          alt={product.title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className={`object-cover transition duration-300 group-hover:scale-105 ${isEpuise ? "opacity-50 grayscale" : ""}`}
        />

        {/* Épuisé */}
        {isEpuise && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-[#1A1A1A]/80 px-3 py-1 text-xs font-black text-white backdrop-blur-sm">
              Épuisé
            </span>
          </div>
        )}

        {/* Badges haut-gauche */}
        {!isEpuise && (
          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {boosted ? (
              <span className="flex items-center gap-1 rounded-md bg-[#1A1A1A]/90 px-2 py-0.5 text-[10px] font-black text-white backdrop-blur-sm">
                <Zap className="h-2.5 w-2.5 fill-white" />
                BOOST
              </span>
            ) : (
              <span className="rounded-md bg-[#009688] px-2 py-0.5 text-[10px] font-black text-white shadow-sm">
                NOUVEAU
              </span>
            )}
            {product.seller_is_certified && (
              <span className="flex items-center gap-0.5 rounded-md bg-amber-400/90 px-2 py-0.5 text-[10px] font-black text-white backdrop-blur-sm">
                <BadgeCheck className="h-2.5 w-2.5 fill-white" />
                CERTIFIÉ
              </span>
            )}
          </div>
        )}
      </Link>

      {/* Favori — overlay sur l'image (masqué sur ses propres annonces) */}
      {!isEpuise && (
        <div className="absolute right-2 top-2 z-10">
          <ProductCardFavorite productId={product.id} sellerId={product.seller_id} />
        </div>
      )}

      {/* ── Infos ───────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-2 p-3">

        {/* Titre */}
        <Link
          href={`/products/${product.id}`}
          className="line-clamp-2 text-[13px] font-bold leading-snug text-[#1A1A1A] hover:text-[#009688]"
        >
          {product.title}
        </Link>

        {/* Prix */}
        <p className="text-[15px] font-black text-[#009688]">
          {formatMoney(product.price, country)}
        </p>

        {/* Catégorie · taille (masqué si taille < 2 chars ou absent) */}
        {!compact && (
          <p className="text-[11px] font-medium text-slate-400">
            {categoryLabel(product.category)}
            {product.size && product.size.trim().length >= 2
              ? ` · ${product.size}`
              : ""}
          </p>
        )}

        {/* Vendeur — toujours visible, badge certifié masqué en compact */}
        <Link
          href={`/store/${product.seller_id}`}
          className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 transition hover:text-[#009688]"
        >
          {!compact && product.seller_is_certified && (
            <BadgeCheck className="h-3 w-3 shrink-0 text-amber-400" />
          )}
          <span className="truncate">{product.seller_name || "Boutique Rivendy"}</span>
        </Link>

        {/* Spacer pour pousser le bouton en bas */}
        <div className="flex-1" />

        {/* ── Action ──────────────────────────────────────────── */}
        {!isEpuise && (
          <div className="border-t border-slate-100 pt-2.5">
            <ProductCardAction product={product} />
          </div>
        )}
      </div>
    </article>
  );
}
