import Image from "next/image";
import { BadgeCheck, CalendarDays, MapPin, ShoppingBag, Star, Users } from "lucide-react";
import type { Country, Product, Profile } from "@/types/rivendy";
import { categoryLabel } from "@/lib/utils/format";
import { FollowButton } from "@/features/store/follow-button";
import { ShareButton } from "@/components/ui/share-button";
import { StoreCoverEditButton, StoreAvatarEditButton } from "@/features/store/store-image-editor";
import { StoreHeroCta } from "@/features/store/store-hero-cta";
import { distinctCategories } from "@/features/store/store-helpers";

interface TrustSummary {
  score: number;
  totalReviews: number;
  verifiedReviews: number;
  label: string;
}

/** Une entrée de la carte de stats flottante : icône + valeur + libellé. */
function StatItem({
  icon: Icon,
  primary,
  secondary,
  numeric,
}: {
  icon: typeof Star;
  primary: string;
  secondary: string;
  numeric: boolean;
}) {
  return (
    <div className="flex flex-col items-center px-1 text-center">
      <Icon className="mb-1 h-4 w-4 text-[#009688]" />
      <span
        className={
          numeric
            ? "text-xl font-black leading-none text-slate-900"
            : "text-[11px] font-black leading-tight text-slate-700"
        }
      >
        {primary}
      </span>
      <span className="mt-0.5 text-[10px] font-semibold leading-tight text-slate-400">{secondary}</span>
    </div>
  );
}

export function StoreHero({
  seller,
  country,
  trust,
  followersCount,
  memberSince,
  products,
  shareUrl,
}: {
  seller: Profile;
  country: Country;
  trust: TrustSummary;
  followersCount: number;
  memberSince: string | null;
  products: Product[];
  shareUrl: string;
}) {
  const sellerName = seller.store_name || seller.full_name || "Boutique Rivendy";
  const bannerSrc = seller.store_banner_url_web || seller.store_banner_url;
  const cats = distinctCategories(products).slice(0, 4);
  const sales = seller.total_sales ?? 0;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
      <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
        {/* ── Panneau identité (gauche) ─────────────────────────────── */}
        <div className="order-2 flex flex-col justify-center gap-4 p-6 md:p-8 lg:order-1">
          {seller.is_certified && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#E0F2F1] px-3 py-1 text-xs font-black text-[#009688]">
              <BadgeCheck className="h-3.5 w-3.5 fill-[#009688] text-white" />
              Vendeur certifié
            </span>
          )}

          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-[#E0F2F1] shadow-md md:h-28 md:w-28">
                {seller.avatar_url ? (
                  <Image src={seller.avatar_url} alt={sellerName} fill sizes="112px" className="object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-4xl font-black text-[#009688]">
                    {sellerName.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              {seller.is_certified && (
                <span className="absolute bottom-1 right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-[#009688]">
                  <BadgeCheck className="h-3.5 w-3.5 text-white" />
                </span>
              )}
              <StoreAvatarEditButton sellerId={seller.id} />
            </div>

            {/* Nom + méta */}
            <div className="min-w-0 pt-1">
              <h1 className="text-2xl font-black leading-tight text-slate-900 md:text-3xl lg:text-4xl">
                {sellerName}
              </h1>

              {cats.length > 0 && (
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {cats.map((c) => categoryLabel(c)).join(" • ")}
                </p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-400">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {country.name}
                </span>
                {memberSince ? (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Membre depuis {memberSince}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[#009688]">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Nouveau vendeur
                  </span>
                )}
              </div>
            </div>
          </div>

          {seller.store_description && (
            <p className="max-w-lg text-sm leading-relaxed text-slate-500">{seller.store_description}</p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <StoreHeroCta sellerId={seller.id} />
            <ShareButton
              variant="button"
              label="Partager"
              title={sellerName}
              text={`Découvrez la boutique ${sellerName} sur Rivendy !`}
              url={shareUrl}
              className="h-11 rounded-full px-5"
            />
            <FollowButton sellerId={seller.id} />
          </div>
        </div>

        {/* ── Bannière + stats flottantes (droite) ──────────────────── */}
        <div className="relative order-1 min-h-[220px] bg-slate-900 lg:order-2 lg:min-h-full">
          {bannerSrc ? (
            <Image src={bannerSrc} alt="" fill sizes="(max-width: 1024px) 100vw, 45vw" priority className="object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#009688_0%,#004D40_100%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent lg:bg-gradient-to-l" />
          <StoreCoverEditButton sellerId={seller.id} />

          {/* Carte stats flottante */}
          <div className="absolute inset-x-4 bottom-4 lg:inset-x-auto lg:bottom-5 lg:right-5">
            <div className="grid grid-cols-3 gap-1 rounded-2xl border border-white/60 bg-white/95 p-3 shadow-lg backdrop-blur-sm lg:gap-2 lg:p-4">
              <StatItem
                icon={Star}
                numeric={trust.totalReviews > 0}
                primary={trust.totalReviews > 0 ? String(trust.totalReviews) : "Pas encore d'avis"}
                secondary={trust.totalReviews > 0 ? "avis" : "0 avis"}
              />
              <div className="border-x border-slate-100">
                <StatItem icon={Users} numeric primary={String(followersCount)} secondary="Abonnés" />
              </div>
              <StatItem
                icon={ShoppingBag}
                numeric={sales > 0}
                primary={sales > 0 ? String(sales) : "Première commande"}
                secondary={sales > 0 ? "ventes" : "à venir"}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
