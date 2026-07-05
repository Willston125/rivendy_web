import Image from "next/image";
import Link from "next/link";
import { MapPin, BadgeCheck, ArrowRight, Truck, Zap, HardHat } from "lucide-react";
import type { ConstructionCompany } from "./construction-listings";

/** Carte société Construction (fournisseur/quincaillerie/dépôt). Clic →
 * /construction/[id] (catalogue dédié — ne remplace pas /store/[id]). */
export function ConstructionCompanyCard({ company }: { company: ConstructionCompany }) {
  const inner = (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md">
      <div className="relative h-32 w-full bg-[#009688]/10">
        {company.coverUrl ? (
          <Image src={company.coverUrl} alt={company.sellerName} fill sizes="(max-width: 680px) 100vw, 680px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#009688]">
            <HardHat className="h-9 w-9" />
          </div>
        )}
        {company.hasPromo && (
          <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-[#FF6B35] px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
            <Zap className="h-3 w-3 fill-white" />
            Promo
          </span>
        )}
      </div>

      <div className="p-3.5">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate text-[15px] font-black text-[#1A1A1A]">{company.sellerName || "Fournisseur"}</h3>
          {company.isVerified && <BadgeCheck className="h-4 w-4 shrink-0 text-[#009688]" />}
        </div>
        {company.specialties.length > 0 && (
          <p className="mt-0.5 truncate text-[12.5px] font-medium text-slate-500">{company.specialties.join(" · ")}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11.5px] font-bold">
          {company.zone && (
            <span className="flex items-center gap-1 text-slate-500">
              <MapPin className="h-3.5 w-3.5" />
              {company.zone}
            </span>
          )}
          {company.hasDelivery && (
            <span className="flex items-center gap-1 text-[#009688]">
              <Truck className="h-3.5 w-3.5" />
              Livraison
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-semibold text-slate-500">
            {company.productCount} produit{company.productCount > 1 ? "s" : ""}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#009688] px-3 py-2 text-[12px] font-bold text-white">
            Voir le catalogue
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </article>
  );

  if (!company.sellerId) return <div className="cursor-default opacity-90">{inner}</div>;

  return (
    <Link href={`/construction/${company.sellerId}`} className="block">
      {inner}
    </Link>
  );
}
