import Link from "next/link";
import Image from "next/image";
import { Heart, BadgeCheck, Flame, CheckCircle2 } from "lucide-react";
import {
  WEDDING_HOME_CHIPS,
  weddingPriceInfo,
  weddingFeatures,
} from "@/features/products/wedding-listings";
import { firstPhoto, formatMoney } from "@/lib/utils/format";
import type { Product, Country } from "@/types/rivendy";

/**
 * Carte prestataire mariage — nouvelle infra 2026-07-18 (7 sous-types).
 * Aucun contact direct vendeur ; clic → fiche produit (flux inchangé).
 */
export function WeddingOfferCard({ product, country }: { product: Product; country: Country }) {
  const priceInfo = weddingPriceInfo(product);
  const features = weddingFeatures(product);
  const isBoosted = product.status === "boosted";
  const chip = WEDDING_HOME_CHIPS.find((c) => c.typeKeys.includes(product.subcategory ?? ""));
  const chipLabel = chip && chip.id !== "tous" ? chip.label : "";

  const priceText = priceInfo.amount
    ? `${priceInfo.prefix}${formatMoney(Number(priceInfo.amount) || product.price, country)}${priceInfo.suffix}`
    : `${priceInfo.prefix}${formatMoney(product.price, country)}${priceInfo.suffix}`;

  return (
    <Link
      href={`/products/${product.id}`}
      className="group block overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[16/10] w-full bg-slate-100">
        <Image
          src={firstPhoto(product)}
          alt={product.title}
          fill
          sizes="(max-width: 680px) 100vw, 340px"
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
          {product.seller_is_certified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-1 text-[10.5px] font-bold text-white shadow-sm">
              <BadgeCheck className="h-3 w-3" />
              Vérifié
            </span>
          )}
          {isBoosted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FF6B35] px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
              <Flame className="h-3 w-3" />
              Très demandé
            </span>
          )}
        </div>
      </div>

      <div className="p-3.5">
        {chipLabel && (
          <span className="mb-1.5 inline-block rounded-full bg-[#009688] px-2.5 py-1 text-[11px] font-bold text-white">
            {chipLabel}
          </span>
        )}
        <h3 className="truncate text-[15px] font-black text-[#1A1A1A]">{product.title}</h3>
        <p className="mt-1 text-[15px] font-black text-[#009688]">{priceText}</p>

        {features.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {features.map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
              >
                <CheckCircle2 className="h-3 w-3 text-slate-400" />
                {f}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-end">
          <span className="inline-flex items-center gap-1 rounded-xl bg-[#009688] px-3.5 py-2 text-[12.5px] font-bold text-white">
            <Heart className="h-3.5 w-3.5" />
            Voir détails
          </span>
        </div>
      </div>
    </Link>
  );
}
