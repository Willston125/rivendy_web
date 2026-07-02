import Link from "next/link";
import Image from "next/image";
import { Cross, Bike, BadgeCheck, ClipboardPlus, ArrowRight } from "lucide-react";
import type { PharmacyGroup } from "@/features/products/pharmacy-grouping";

/**
 * Carte établissement premium (1 par pharmacie) — onglet Pharmacie web.
 * Clic → catalogue de la pharmacie (/pharmacy/[sellerId]). Aucun contact
 * direct — tout passe par Rivendy.
 * Charte Rivendy : #009688 / #007168 + accent #FF6B35 + neutres.
 */
export function PharmacyEstablishmentCard({ group }: { group: PharmacyGroup }) {
  const produits = `${group.productCount} ${group.productCount > 1 ? "produits" : "produit"}`;
  const subtitle = [group.pharmacyType, group.deliveryZone].filter(Boolean).join(" · ");

  const inner = (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md">
      {/* Cover */}
      <div className="relative h-32 w-full bg-[#E0F2F1]">
        {group.coverUrl ? (
          <Image
            src={group.coverUrl}
            alt={group.sellerName}
            fill
            sizes="(max-width: 680px) 100vw, 680px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#009688]">
            <Cross className="h-9 w-9" />
          </div>
        )}
        {group.hasPrescriptionProducts && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-[#007168] px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
            <ClipboardPlus className="h-3 w-3" />
            Ordonnance
          </span>
        )}
      </div>

      {/* Corps */}
      <div className="p-3">
        <div className="flex items-start gap-3">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[#E0F2F1]">
            {group.logoUrl ? (
              <Image
                src={group.logoUrl}
                alt={group.sellerName}
                fill
                sizes="44px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[#009688]">
                <Cross className="h-5 w-5" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-[15px] font-black text-[#1A1A1A]">
                {group.sellerName}
              </h3>
              {group.isVerified && (
                <BadgeCheck className="h-4 w-4 shrink-0 text-[#009688]" />
              )}
            </div>
            {subtitle && (
              <p className="truncate text-[12.5px] font-medium text-slate-500">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {group.pharmacyType && (
            <span className="rounded-full bg-[#007168] px-2.5 py-1 text-[11px] font-bold text-white">
              {group.pharmacyType}
            </span>
          )}
          {group.hasDelivery && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#E0F2F1] px-2.5 py-1 text-[11px] font-bold text-[#009688]">
              <Bike className="h-3 w-3" />
              Livraison
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[#007168]">{produits}</span>
          <span className="inline-flex items-center gap-1 rounded-xl bg-[#009688] px-3.5 py-2 text-[12.5px] font-bold text-white">
            Voir le catalogue
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </article>
  );

  if (!group.sellerId) {
    return <div className="cursor-default opacity-90">{inner}</div>;
  }

  return (
    <Link href={`/pharmacy/${group.sellerId}`} className="block">
      {inner}
    </Link>
  );
}
