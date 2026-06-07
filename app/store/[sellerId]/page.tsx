import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  Star,
} from "lucide-react";
import { FacebookIcon, InstagramIcon, TikTokIcon } from "@/components/ui/social-icons";
import { ProductGrid } from "@/features/products/product-grid";
import { StoreRatings } from "@/features/store/store-ratings";
import { VoiceNotePlayer } from "@/features/store/voice-note-player";
import { FollowButton } from "@/features/store/follow-button";
import { PrintCatalog } from "@/features/store/print-catalog";
import { ShareButton } from "@/components/ui/share-button";
import { ReportButton } from "@/features/products/report-button";
import { UnavailableProducts } from "@/features/store/unavailable-products";
import { createAnonServerClient } from "@/lib/supabase/server";
import {
  getCountry,
  getSellerProfile,
  getSellerPublicProducts,
  getStoreTrustSummary,
  getVendorPillars,
} from "@/services/public-data";
import { VendorTrustPillars } from "@/features/store/vendor-trust-pillars";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { StoreCoverEditButton, StoreAvatarEditButton } from "@/features/store/store-image-editor";

/* ── Déduplication React.cache — évite 2 appels DB identiques
   (generateMetadata + page body appellent tous deux getSellerProfile) ── */
const getSellerProfileCached = cache(getSellerProfile);

/* ── generateMetadata ────────────────────────────────────────────── */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ sellerId: string }>;
}): Promise<Metadata> {
  const { sellerId } = await params;
  const seller = await getSellerProfileCached(sellerId);
  if (!seller) return { title: "Boutique introuvable — Rivendy" };

  const name = seller.store_name || seller.full_name || "Boutique Rivendy";
  const country = await getCountry(seller.country_id || "DJ");
  const bannerUrl = seller.store_banner_url_web || seller.store_banner_url || seller.avatar_url;

  return {
    title: `${name} — Rivendy`,
    description:
      seller.store_description ||
      `Découvrez les produits de ${name} sur Rivendy, la marketplace #1 à ${country.name}.`,
    openGraph: {
      title: name,
      description: seller.store_description ?? "",
      images: bannerUrl ? [{ url: bannerUrl }] : [],
      type: "website",
    },
  };
}

/* ── Helpers ─────────────────────────────────────────────────────── */

/** Affiche "—" en grisé pour éviter le look "boutique morte" sur les 0 */
function StatNum({ value }: { value: number }) {
  if (value === 0)
    return <span className="text-slate-300 font-black text-lg">—</span>;
  return <span className="text-lg font-black text-slate-900">{value}</span>;
}

/* ── Page ────────────────────────────────────────────────────────── */
export default async function StorePage({
  params,
}: {
  params: Promise<{ sellerId: string }>;
}) {
  const { sellerId } = await params;

  // Étape 1 : profil en premier (nécessaire pour country_id + guard notFound)
  const seller = await getSellerProfileCached(sellerId);
  if (!seller) notFound();

  // Étape 2 : tout le reste en parallèle, y compris getCountry
  const [products, trust, pillars, followCountRes, country] = await Promise.all([
    getSellerPublicProducts(sellerId, true),
    getStoreTrustSummary(sellerId),
    getVendorPillars(sellerId),
    createAnonServerClient()
      .from("store_follows")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", sellerId),
    getCountry(seller.country_id || "DJ"),
  ]);

  const followersCount = followCountRes.count ?? 0;

  const activeProducts = products.filter(
    (p) => p.status === "active" || p.status === "boosted",
  );
  const unavailable = products.filter(
    (p) => p.status === "sold" || p.status === "epuise",
  );

  const sellerName = seller.store_name || seller.full_name || "Boutique Rivendy";

  /* Calcul étoiles trust */
  const trustStars = Math.round(Number(trust.score ?? 0));

  /* Date membre */
  const memberSince = seller.created_at
    ? new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
        new Date(seller.created_at as string),
      )
    : null;

  const hasSocials = seller.facebook_url || seller.instagram_url || seller.tiktok_url;
  const bannerSrc = seller.store_banner_url_web || seller.store_banner_url;

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-8">

      {/* Fil d'Ariane */}
      <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: "Boutique" }, { label: sellerName }]} />

      {/* ══════════════════════════════════════════════════════════════
          HEADER BOUTIQUE
      ══════════════════════════════════════════════════════════════ */}
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm">

        {/* Bannière — couverture web prioritaire, fallback app */}
        <div className="relative h-36 bg-slate-900 md:h-52">
          {bannerSrc ? (
            <Image
              src={bannerSrc}
              alt=""
              fill
              sizes="100vw"
              priority
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#009688_0%,#004D40_100%)]" />
          )}
          {/* Dégradé bas pour lisibilité du bouton d'édition */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          {/* Édition couverture — propriétaire uniquement */}
          <StoreCoverEditButton sellerId={seller.id} />
        </div>

        {/* Corps sous la bannière */}
        <div className="relative px-5 pb-6 md:px-8">

          {/* ── Bande 1 : Avatar + Identité + Stats ─────────────── */}
          <div className="-mt-14 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">

            {/* Avatar + Nom + Meta */}
            <div className="flex items-end gap-4">
              {/* Avatar (+ badge édition propriétaire) */}
              <div className="relative shrink-0">
                <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-[#E0F2F1] shadow-md">
                  {seller.avatar_url ? (
                    <Image
                      src={seller.avatar_url}
                      alt={sellerName}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-3xl font-black text-[#009688]">
                      {sellerName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <StoreAvatarEditButton sellerId={seller.id} />
              </div>

              {/* Nom + badges inline + meta */}
              <div className="pb-1 min-w-0">
                {/* H1 + badge certifié sur la même ligne */}
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black text-slate-900 md:text-3xl leading-tight">
                    {sellerName}
                  </h1>
                  {seller.is_certified && (
                    <span className="flex items-center gap-1 rounded-full bg-[#009688] px-2.5 py-0.5 text-[11px] font-black text-white shrink-0">
                      <BadgeCheck className="h-3 w-3 fill-white" />
                      Certifié
                    </span>
                  )}
                </div>

                {/* Description */}
                {seller.store_description && (
                  <p className="mt-1 text-sm text-slate-500 line-clamp-2 max-w-md">
                    {seller.store_description}
                  </p>
                )}

                {/* Meta : pays · membre depuis */}
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-400">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {country.name}
                  </span>
                  {memberSince && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      Membre depuis {memberSince}
                    </span>
                  )}
                </div>

                {/* ── Bande actions : Follow / Share / Réseaux ──── */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <FollowButton sellerId={seller.id} />
                  <ShareButton
                    title={sellerName}
                    text={`Découvrez la boutique ${sellerName} sur Rivendy !`}
                    className="h-9 w-9 bg-slate-100 hover:bg-slate-200"
                  />
                  {hasSocials && (
                    <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
                      {seller.facebook_url && (
                        <a
                          href={seller.facebook_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Facebook"
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[#1877F2] transition hover:bg-slate-200"
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
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[#E4405F] transition hover:bg-slate-200"
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
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-800 transition hover:bg-slate-200"
                        >
                          <TikTokIcon className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4 md:shrink-0">
              {/* Trust score */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                <StatNum value={trust.score > 0 ? trust.score : 0} />
                <div className="mt-0.5 flex justify-center gap-px">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-2.5 w-2.5 ${
                        i < trustStars
                          ? "fill-amber-400 text-amber-400"
                          : "fill-slate-200 text-slate-200"
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-0.5 text-[10px] font-bold text-slate-400">Trust</p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                <StatNum value={trust.totalReviews} />
                <p className="mt-1 text-[10px] font-bold text-slate-400">Avis</p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                <StatNum value={followersCount} />
                <p className="mt-1 text-[10px] font-bold text-slate-400">Abonnés</p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                <StatNum value={seller.total_sales ?? 0} />
                <p className="mt-1 text-[10px] font-bold text-slate-400">Ventes</p>
              </div>
            </div>
          </div>

          {/* ── Bande 2 : Note vocale + Piliers performance ────── */}
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

          {/* ── Bande 3 : Badges trust + Signaler ───────────────── */}
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
            {/* Signaler — poussé à droite */}
            <div className="ml-auto">
              <ReportButton targetId={seller.id} type="seller" className="pt-0" />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          PRODUITS ACTIFS
      ══════════════════════════════════════════════════════════════ */}
      <section className="mt-8 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-slate-900">
            Produits disponibles
            {activeProducts.length > 0 && (
              <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-bold text-slate-500">
                {activeProducts.length}
              </span>
            )}
          </h2>
          <PrintCatalog seller={seller} products={products} country={country} />
        </div>

        {activeProducts.length > 0 ? (
          <ProductGrid products={activeProducts} country={country} cols={4} />
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
            <ShoppingBag className="h-10 w-10 text-slate-200" />
            <p className="mt-3 font-semibold text-slate-500">Aucun produit disponible pour le moment</p>
            <Link href="/" className="mt-4 text-sm font-bold text-[#009688] hover:underline">
              Explorer d&apos;autres boutiques →
            </Link>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════
          PRODUITS ARCHIVÉS (collapsible, client component)
      ══════════════════════════════════════════════════════════════ */}
      <UnavailableProducts products={unavailable} />

      {/* ══════════════════════════════════════════════════════════════
          AVIS ET ÉVALUATIONS DE LA BOUTIQUE
      ══════════════════════════════════════════════════════════════ */}
      <section className="mt-12 border-t border-slate-100 pt-8">
        <h2 className="mb-6 text-xl font-black text-slate-900">Avis de la boutique</h2>
        <StoreRatings sellerId={seller.id} />
      </section>
    </div>
  );
}
