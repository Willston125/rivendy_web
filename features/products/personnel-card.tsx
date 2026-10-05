import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, MapPin, Award, CalendarCheck, ArrowRight } from "lucide-react";
import type { Country, Product } from "@/types/rivendy";
import { findPhaseBListing } from "@/lib/listings";
import { firstPhoto, formatMoney } from "@/lib/utils/format";

/**
 * Carte « prestataire » de l'onglet Personnels — miroir de `PersonnelCard`
 * (rivendy_app/lib/features/products/widgets/special_listing_cards.dart) :
 * avatar, métier (sous-type Phase B), zone, expérience, disponibilité.
 *
 * Tout mène à la fiche : AUCUN contact direct, la demande passe par Rivendy.
 *
 * Écart volontaire avec l'app : le montant affiché est `product.price` (prix
 * acheteur, commission incluse), pas l'attribut libre `tarif_*` saisi par le
 * vendeur — celui-ci montrerait un montant inférieur à celui payé.
 */
function attr(p: Product, keys: string[]): string {
  for (const k of keys) {
    const v = String(p.extra_attributes?.[k] ?? "").trim();
    if (v) return v;
  }
  return "";
}

export function PersonnelCard({ product, country }: { product: Product; country?: Country | null }) {
  const listing = findPhaseBListing(product.subcategory);
  const zone = attr(product, ["zone", "zone_couverture", "localisation"]);
  const experience = attr(product, ["experience"]);
  const dispo = attr(product, ["disponibilite", "type_garde", "type_mission"]);
  const perDay = attr(product, ["tarif_journee"]) !== "";
  const name = product.show_as_rivendy
    ? "Rivendy"
    : (product.seller_name || "").trim() || product.title;
  const avatar = (product.show_as_rivendy ? "" : product.seller_avatar_url) || firstPhoto(product);
  const href = `/products/${product.id}`;

  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm transition hover:shadow-md">
      <Link href={href} className="flex items-start gap-3">
        <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-[#009688]/25 bg-[#009688]/10">
          {avatar ? (
            <Image src={avatar} alt={name} fill sizes="64px" className="object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-2xl">
              {listing?.emoji || "👤"}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            <span className="truncate text-[15px] font-black text-slate-900">{name}</span>
            {product.seller_is_certified && !product.show_as_rivendy && (
              <BadgeCheck className="h-4 w-4 shrink-0 text-[#009688]" aria-label="Vendeur certifié" />
            )}
          </span>
          {listing && (
            <span className="mt-0.5 block text-[13px] font-semibold text-[#007168]">
              {`${listing.emoji} ${listing.label}`.trim()}
            </span>
          )}
          <span className="mt-0.5 block truncate text-[12.5px] text-slate-500">{product.title}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[15px] font-black text-[#009688]">{formatMoney(product.price, country)}</span>
          {perDay && <span className="block text-[10.5px] text-slate-400">/ jour</span>}
        </span>
      </Link>

      {(zone || experience || dispo) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {zone && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[11.5px] font-semibold text-slate-600">
              <MapPin className="h-3.5 w-3.5" />
              {zone}
            </span>
          )}
          {experience && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[11.5px] font-semibold text-slate-600">
              <Award className="h-3.5 w-3.5" />
              {/^\d+$/.test(experience) ? `${experience} ans` : experience}
            </span>
          )}
          {dispo && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[11.5px] font-semibold text-slate-600">
              <CalendarCheck className="h-3.5 w-3.5" />
              {dispo}
            </span>
          )}
        </div>
      )}

      <Link
        href={href}
        className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-[#009688] py-2 text-[12.5px] font-bold text-white transition hover:bg-[#007168]"
      >
        Voir le profil
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  );
}
