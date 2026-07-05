import Image from "next/image";
import Link from "next/link";
import { Package, Star } from "lucide-react";
import type { Country, Product } from "@/types/rivendy";
import { firstPhoto, formatMoney } from "@/lib/utils/format";
import { AddToCartButton } from "@/features/products/add-to-cart-button";

/** Palier de colis déduit du prix (miroir food_package_card.dart). */
function tier(price: number): { label: string; color: string } {
  if (price <= 10000) return { label: "Colis S", color: "#66BB6A" };
  if (price <= 20000) return { label: "Colis M", color: "#43A047" };
  return { label: "Colis L", color: "#2E7D32" };
}

/** Découpe `package_contents` en puces (saut de ligne, puis ; ou ,). */
function bullets(raw: string): string[] {
  const text = raw.trim();
  if (!text) return [];
  const parts = text.includes("\n")
    ? text.split("\n")
    : text.includes(";")
      ? text.split(";")
      : text.split(",");
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Carte colis alimentaire — parité FoodPackageCard (app), section Supermarché. */
export function FoodPackageCard({ product, country }: { product: Product; country: Country }) {
  const t = tier(product.price);
  const items = bullets(product.package_contents ?? "");
  const rating = Number(product.average_rating ?? 0);

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-md">
      <Link href={`/products/${product.id}`} className="block">
        <div className="relative aspect-video w-full bg-[#E8F5E9]">
          {product.photos?.[0] ? (
            <Image src={firstPhoto(product)} alt={product.title} fill sizes="(max-width: 680px) 100vw, 680px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#4CAF50]">
              <Package className="h-12 w-12" />
            </div>
          )}
          <span
            className="absolute left-3 top-3 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-sm"
            style={{ backgroundColor: t.color }}
          >
            {t.label}
          </span>
        </div>
      </Link>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/products/${product.id}`} className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-[17px] font-black leading-tight text-[#1A1A1A]">{product.title}</h3>
          </Link>
          <span className="shrink-0 text-xl font-black text-[#2E7D32]">{formatMoney(product.price, country)}</span>
        </div>

        {items.length > 0 ? (
          <div className="mt-3.5">
            <div className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-[#4CAF50]" />
              <span className="text-xs font-bold tracking-wide text-[#4CAF50]">Contenu du colis</span>
            </div>
            <ul className="mt-2 space-y-1">
              {items.slice(0, 6).map((b, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[13px] text-slate-600">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#4CAF50]" />
                  {b}
                </li>
              ))}
            </ul>
            {items.length > 6 && (
              <p className="mt-1 text-xs italic text-slate-400">+ {items.length - 6} autres articles…</p>
            )}
          </div>
        ) : product.description ? (
          <p className="mt-2.5 line-clamp-3 text-[13px] leading-relaxed text-slate-500">{product.description}</p>
        ) : null}

        <div className="mt-3.5 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between gap-3">
            {rating > 0 ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                <Star className="h-3.5 w-3.5 fill-[#FFA726] text-[#FFA726]" />
                {rating.toFixed(1)}
              </span>
            ) : (
              <span />
            )}
            <AddToCartButton product={product} label="Ajouter" size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
