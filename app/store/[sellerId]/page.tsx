import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  MapPin,
  Package,
  ShieldCheck,
  ShoppingBag,
  Star,
  Zap,
  Link2
} from "lucide-react";
import { FacebookIcon, InstagramIcon } from "@/components/ui/social-icons";
import { ProductGrid } from "@/features/products/product-grid";
import { StoreRatings } from "@/features/store/store-ratings";
import { VoiceNotePlayer } from "@/features/store/voice-note-player";
import { FollowButton } from "@/features/store/follow-button";
import { PrintCatalog } from "@/features/store/print-catalog";
import { ShareButton } from "@/components/ui/share-button";
import { ReportButton } from "@/features/products/report-button";
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

/* ── generateMetadata ────────────────────────────────────────────── */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ sellerId: string }>;
}): Promise<Metadata> {
  const { sellerId } = await params;
  const seller = await getSellerProfile(sellerId);
  if (!seller) return { title: "Boutique introuvable — Rivendy" };

  const name = seller.store_name || seller.full_name || "Boutique Rivendy";
  const country = await getCountry(seller.country_id || "DJ");
  return {
    title: `${name} — Rivendy`,
    description:
      seller.store_description ||
      `Découvrez les produits de ${name} sur Rivendy, la marketplace #1 à ${country.name}.`,
    openGraph: {
      title: name,
      description: seller.store_description ?? "",
      images: seller.avatar_url ? [{ url: seller.avatar_url }] : [],
      type: "website",
    },
  };
}

/* ── Page ────────────────────────────────────────────────────────── */
export default async function StorePage({
  params,
}: {
  params: Promise<{ sellerId: string }>;
}) {
  const { sellerId } = await params;

  const [seller, products, trust, pillars, followCountRes] = await Promise.all([
    getSellerProfile(sellerId),
    getSellerPublicProducts(sellerId, true),
    getStoreTrustSummary(sellerId),
    getVendorPillars(sellerId),
    createAnonServerClient()
      .from("store_follows")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", sellerId),
  ]);

  const followersCount = followCountRes.count ?? 0;

  if (!seller) notFound();

  const country = await getCountry(seller.country_id || "DJ");

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-8">

      {/* Fil d'Ariane */}
      <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: "Boutique" }, { label: sellerName }]} />

      {/* ══════════════════════════════════════════════════════════════
          HEADER BOUTIQUE
      ══════════════════════════════════════════════════════════════ */}
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm">

        {/* Bannière */}
        <div className="relative h-36 bg-slate-900 md:h-52">
          {seller.store_banner_url ? (
            <Image
              src={seller.store_banner_url}
              alt=""
              fill
              sizes="100vw"
              priority
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#009688_0%,#004D40_100%)]" />
          )}
          {/* Dégradé bas */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>

        {/* Infos sous la bannière */}
        <div className="relative px-5 pb-6 md:px-8">
          <div className="-mt-14 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">

            {/* Avatar + nom */}
            <div className="flex items-end gap-4">
              {/* Avatar */}
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-white bg-[#E0F2F1] shadow-md">
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

              {/* Nom + badges */}
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black text-slate-900 md:text-3xl">
                    {sellerName}
                  </h1>
                  {seller.is_certified && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-black text-white">
                      <BadgeCheck className="h-3 w-3 fill-white" />
                      Certifié
                    </span>
                  )}
                  <FollowButton sellerId={seller.id} />
                  <ShareButton
                    title={sellerName}
                    text={`Découvrez la boutique ${sellerName} sur Rivendy !`}
                    className="h-8 w-8 bg-slate-100 hover:bg-slate-200"
                  />
                </div>

                {/* Description */}
                {seller.store_description && (
                  <p className="mt-1 text-sm text-slate-500 line-clamp-2">
                    {seller.store_description}
                  </p>
                )}

                {/* Meta : pays · membre depuis */}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-400">
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

                {/* Réseaux sociaux */}
                {(seller.facebook_url || seller.instagram_url || seller.tiktok_url) && (
                  <div className="mt-3 flex items-center gap-2">
                    {seller.facebook_url && (
                      <a href={seller.facebook_url} target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[#1877F2] transition hover:bg-slate-200">
                        <FacebookIcon className="h-4 w-4" />
                      </a>
                    )}
                    {seller.instagram_url && (
                      <a href={seller.instagram_url} target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[#E4405F] transition hover:bg-slate-200">
                        <InstagramIcon className="h-4 w-4" />
                      </a>
                    )}
                    {seller.tiktok_url && (
                      <a href={seller.tiktok_url} target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-800 transition hover:bg-slate-200">
                        <span className="font-bold text-[10px]">TK</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              {/* Trust score */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                <p className="text-lg font-black text-slate-900">
                  {trust.score > 0 ? trust.score : "—"}
                </p>
                {/* Étoiles */}
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

              {/* Avis */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                <p className="text-lg font-black text-slate-900">{trust.totalReviews}</p>
                <p className="mt-1 text-[10px] font-bold text-slate-400">Avis</p>
              </div>

              {/* Abonnés */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                <p className="text-lg font-black text-slate-900">{followersCount}</p>
                <p className="mt-1 text-[10px] font-bold text-slate-400">Abonnés</p>
              </div>

              {/* Ventes */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                <p className="text-lg font-black text-slate-900">{seller.total_sales ?? 0}</p>
                <p className="mt-1 text-[10px] font-bold text-slate-400">Ventes</p>
              </div>
            </div>
          </div>

          {/* Note vocale + performance vendeur (bande dédiée, sous l'identité) */}
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

          {/* Badges trust label + protection */}
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
              <span className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
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
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              Produits disponibles
              {activeProducts.length > 0 && (
                <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-bold text-slate-500">
                  {activeProducts.length}
                </span>
              )}
            </h2>
            <p className="mt-0.5 text-xs font-medium text-slate-400">
              Aucun numéro de téléphone ni WhatsApp privé n&apos;est affiché.
            </p>
          </div>
          <PrintCatalog seller={seller} products={products} country={country} />
        </div>

        {activeProducts.length > 0 ? (
          <ProductGrid products={activeProducts} country={country} cols={4} />
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
            <ShoppingBag className="h-10 w-10 text-slate-200" />
            <p className="mt-3 font-semibold text-slate-500">Aucun produit disponible pour le moment</p>
            <Link
              href="/"
              className="mt-4 text-sm font-bold text-[#009688] hover:underline"
            >
              Explorer d&apos;autres boutiques →
            </Link>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════
          PRODUITS INDISPONIBLES
      ══════════════════════════════════════════════════════════════ */}
      {unavailable.length > 0 && (
        <section className="mt-8 space-y-4">
          <h2 className="text-base font-black text-slate-400">
            Vendus ou épuisés
            <span className="ml-2 text-sm font-bold">({unavailable.length})</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unavailable.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 opacity-60"
              >
                {/* Miniature */}
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100 grayscale">
                  {Array.isArray(product.photos) && product.photos.length > 0 ? (
                    <Image
                      src={product.photos[0] as string}
                      alt={product.title}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center">
                      <Package className="h-5 w-5 text-slate-300" />
                    </div>
                  )}
                </div>
                {/* Infos */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-700">{product.title}</p>
                  <p className="text-xs font-semibold text-slate-400">
                    {product.status === "sold" ? "Vendu" : "Épuisé"}
                  </p>
                </div>
                {product.status === "boosted" && (
                  <Zap className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════
          AVIS ET ÉVALUATIONS DE LA BOUTIQUE
      ══════════════════════════════════════════════════════════════ */}
      <section className="mt-12 border-t border-slate-100 pt-8">
        <h2 className="text-xl font-black text-slate-900 mb-6">Avis de la boutique</h2>
        <StoreRatings sellerId={seller.id} />
      </section>
    </div>
  );
}
