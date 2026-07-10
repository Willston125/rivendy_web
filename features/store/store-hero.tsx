import Image from "next/image";
import { BadgeCheck, CalendarDays, MapPin, ShieldCheck, Star } from "lucide-react";
import type { Country, Product, Profile } from "@/types/rivendy";
import { categoryLabel } from "@/lib/utils/format";
import { FacebookIcon, InstagramIcon, TikTokIcon } from "@/components/ui/social-icons";
import { FollowButton } from "@/features/store/follow-button";
import { ShareButton } from "@/components/ui/share-button";
import { ReportButton } from "@/features/products/report-button";
import { VoiceNotePlayer } from "@/features/store/voice-note-player";
import { VendorTrustPillars } from "@/features/store/vendor-trust-pillars";
import { StoreCoverEditButton, StoreAvatarEditButton } from "@/features/store/store-image-editor";
import { StoreHeroCta } from "@/features/store/store-hero-cta";
import { distinctCategories } from "@/features/store/store-helpers";
import type { VendorPillars } from "@/services/public-data";

interface TrustSummary {
  score: number;
  totalReviews: number;
  verifiedReviews: number;
  label: string;
}

/** Une carte stat : si value=0, affiche un libellé positif au lieu de "0"/"—". */
function StatCard({
  value,
  suffix,
  emptyLabel,
  stars,
}: {
  value: number;
  suffix: string;
  emptyLabel: string;
  stars?: boolean;
}) {
  const empty = value === 0;
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-center">
      {empty ? (
        <p className="text-[11px] font-bold leading-tight text-slate-400">{emptyLabel}</p>
      ) : (
        <>
          <span className="text-lg font-black text-slate-900">{value}</span>
          {stars && (
            <div className="mt-0.5 flex justify-center gap-px">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-2.5 w-2.5 ${
                    i < Math.round(value) ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"
                  }`}
                />
              ))}
            </div>
          )}
          <p className="mt-1 text-[10px] font-bold text-slate-400">{suffix}</p>
        </>
      )}
    </div>
  );
}

export function StoreHero({
  seller,
  country,
  trust,
  pillars,
  followersCount,
  memberSince,
  products,
}: {
  seller: Profile;
  country: Country;
  trust: TrustSummary;
  pillars: VendorPillars | null;
  followersCount: number;
  memberSince: string | null;
  products: Product[];
}) {
  const sellerName = seller.store_name || seller.full_name || "Boutique Rivendy";
  const bannerSrc = seller.store_banner_url_web || seller.store_banner_url;
  const hasSocials = seller.facebook_url || seller.instagram_url || seller.tiktok_url;
  const cats = distinctCategories(products).slice(0, 4);

  return (
    <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
      {/* Bannière hero — hauteur premium desktop */}
      <div className="relative h-48 bg-slate-900 sm:h-64 lg:h-[380px]">
        {bannerSrc ? (
          <Image src={bannerSrc} alt="" fill sizes="100vw" priority className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#009688_0%,#004D40_100%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <StoreCoverEditButton sellerId={seller.id} />
      </div>

      <div className="relative px-5 pb-6 md:px-8">
        <div className="-mt-16 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          {/* Avatar + identité */}
          <div className="flex items-end gap-4">
            <div className="relative shrink-0">
              <div className="relative h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-[#E0F2F1] shadow-md lg:h-32 lg:w-32">
                {seller.avatar_url ? (
                  <Image src={seller.avatar_url} alt={sellerName} fill sizes="128px" className="object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-4xl font-black text-[#009688]">
                    {sellerName.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <StoreAvatarEditButton sellerId={seller.id} />
            </div>

            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black leading-tight text-slate-900 md:text-3xl lg:text-4xl">
                  {sellerName}
                </h1>
                {seller.is_certified && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#009688] px-2.5 py-0.5 text-[11px] font-black text-white">
                    <BadgeCheck className="h-3 w-3 fill-white" />
                    Certifié
                  </span>
                )}
              </div>

              {cats.length > 0 && (
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#009688]">
                  {cats.map((c) => categoryLabel(c)).join(" · ")}
                </p>
              )}

              {seller.store_description && (
                <p className="mt-1 line-clamp-2 max-w-md text-sm text-slate-500">{seller.store_description}</p>
              )}

              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-400">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {country.name}
                </span>
                {memberSince ? (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    Membre depuis {memberSince}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[#009688]">
                    <CalendarDays className="h-3 w-3" />
                    Nouveau vendeur
                  </span>
                )}
              </div>

              {/* Actions : CTA principal + Follow + Share + réseaux */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StoreHeroCta sellerId={seller.id} />
                <FollowButton sellerId={seller.id} />
                <ShareButton
                  title={sellerName}
                  text={`Découvrez la boutique ${sellerName} sur Rivendy !`}
                  className="h-10 w-10 bg-slate-100 hover:bg-slate-200"
                />
                {hasSocials && (
                  <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
                    {seller.facebook_url && (
                      <a
                        href={seller.facebook_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Facebook"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-[#1877F2] transition hover:bg-slate-200"
                      >
                        <FacebookIcon className="h-4 w-4" />
                      </a>
                    )}
                    {seller.instagram_url && (
                      <a
                        href={seller.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Instagram"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-[#E4405F] transition hover:bg-slate-200"
                      >
                        <InstagramIcon className="h-4 w-4" />
                      </a>
                    )}
                    {seller.tiktok_url && (
                      <a
                        href={seller.tiktok_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="TikTok"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-800 transition hover:bg-slate-200"
                      >
                        <TikTokIcon className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats intelligentes */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:shrink-0">
            <StatCard value={trust.score} suffix="Trust" emptyLabel="Pas encore évalué" stars />
            <StatCard value={trust.totalReviews} suffix="Avis" emptyLabel="Aucun avis" />
            <StatCard value={followersCount} suffix="Abonnés" emptyLabel="Nouveau" />
            <StatCard value={seller.total_sales ?? 0} suffix="Ventes" emptyLabel="Première à venir" />
          </div>
        </div>

        {/* Note vocale + piliers performance */}
        {(seller.voice_note_url || pillars) && (
          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-stretch">
            {seller.voice_note_url && (
              <div className="lg:flex-1">
                <VoiceNotePlayer audioUrl={seller.voice_note_url} />
              </div>
            )}
            <VendorTrustPillars pillars={pillars} />
          </div>
        )}

        {/* Badges trust + Signaler */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-[#E0F2F1] px-3 py-1 text-xs font-bold text-[#009688]">
            <Star className="h-3 w-3 fill-[#009688]" />
            {trust.label}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600">
            <ShieldCheck className="h-3 w-3 text-[#009688]" />
            Commande centralisée Rivendy
          </span>
          {trust.verifiedReviews > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-[#009688]/20 bg-[#E0F2F1] px-3 py-1 text-xs font-bold text-[#009688]">
              <BadgeCheck className="h-3 w-3" />
              {trust.verifiedReviews} avis vérifiés
            </span>
          )}
          <div className="ml-auto">
            <ReportButton targetId={seller.id} type="seller" className="pt-0" />
          </div>
        </div>
      </div>
    </section>
  );
}
