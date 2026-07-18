import Image from "next/image";
import Link from "next/link";
import { MapPin, ArrowRight, Phone, BadgeCheck } from "lucide-react";
import type { Product, Country } from "@/types/rivendy";
import { firstPhoto, formatMoney } from "@/lib/utils/format";
import {
  locationCategoryLabel,
  locationLocality,
  locationSubtitle,
  locationPriceUnit,
  locationPriceValue,
  locationKeyInfos,
  locationIsAvailable,
} from "./location-listings";

/**
 * Carte offre Location premium (offre-first). Clic → /products/[id]
 * (détail existant + demande via Rivendy). Aucun contact direct.
 * Charte Rivendy : #009688 / #007168.
 */
export function LocationOfferCard({ product, country }: { product: Product; country: Country }) {
  const category = locationCategoryLabel(product);
  const locality = locationLocality(product);
  const subtitle = locationSubtitle(product);
  const infos = locationKeyInfos(product);
  const available = locationIsAvailable(product);
  const priceText = `${formatMoney(locationPriceValue(product), country)} / ${locationPriceUnit(product)}`;

  return (
    <div className="group block overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link href={`/products/${product.id}`} className="block">
      <div className="relative aspect-[16/10] w-full bg-slate-100">
        <Image
          src={firstPhoto(product)}
          alt={product.title}
          fill
          sizes="(max-width: 680px) 100vw, 340px"
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
        {category && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-[#007168] px-2.5 py-1 text-[11px] font-bold text-white">
            {category}
          </span>
        )}
        <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold shadow-sm ${
              available ? "text-[#16A34A]" : "text-[#FF6B35]"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${available ? "bg-[#16A34A]" : "bg-[#FF6B35]"}`} />
            {available ? "Disponible" : "Loué"}
          </span>
          {/* ✓ Vendeur vérifié (mockup 2026-07-18) — uniquement si certifié */}
          {product.seller_is_certified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-1 text-[10.5px] font-bold text-white shadow-sm">
              <BadgeCheck className="h-3 w-3" />
              Vendeur vérifié
            </span>
          )}
        </span>
      </div>

      <div className="p-3.5">
        <h3 className="truncate text-[15px] font-black text-[#1A1A1A]">{product.title}</h3>
        {subtitle && <p className="truncate text-[12.5px] font-medium text-slate-500">{subtitle}</p>}
        {locality && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-slate-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {locality}
          </p>
        )}
        <p className="mt-2 text-[17px] font-black text-[#009688]">{priceText}</p>

        {infos.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {infos.map((info) => (
              <span
                key={info}
                className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600"
              >
                {info}
              </span>
            ))}
          </div>
        )}

      </div>
      </Link>

      {/* Actions : voir l'offre (détail) + appeler Rivendy (jamais le vendeur) */}
      <div className="flex gap-2 px-3.5 pb-3.5">
        <Link
          href={`/products/${product.id}`}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#009688] py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#00897B]"
        >
          Voir l&apos;offre
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        {country.whatsapp_number && (
          <a
            href={`tel:${country.whatsapp_number}`}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-[#009688] px-3.5 py-2.5 text-[13px] font-bold text-[#009688] transition-colors hover:bg-[#009688]/5"
            aria-label="Appeler Rivendy"
          >
            <Phone className="h-3.5 w-3.5" />
            Appeler
          </a>
        )}
      </div>
    </div>
  );
}
