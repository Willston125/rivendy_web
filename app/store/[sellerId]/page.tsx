import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { StoreRatings } from "@/features/store/store-ratings";
import { PrintCatalog } from "@/features/store/print-catalog";
import { UnavailableProducts } from "@/features/store/unavailable-products";
import { createAnonServerClient } from "@/lib/supabase/server";
import {
  getCountry,
  getSellerProfile,
  getSellerPublicProducts,
  getStoreTrustSummary,
  getVendorPillars,
} from "@/services/public-data";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { StoreOwnerBar } from "@/features/store/store-owner-bar";
import { StoreHero } from "@/features/store/store-hero";
import { StoreTrustBar } from "@/features/store/store-trust-bar";
import { StoreNavTabs } from "@/features/store/store-nav-tabs";
import { StoreFeaturedProducts } from "@/features/store/store-featured-products";
import { StoreCatalog } from "@/features/store/store-catalog";
import { StoreAbout } from "@/features/store/store-about";
import { StoreProtectionCard } from "@/features/store/store-protection-card";
import { pickFeatured, storeCompleteness } from "@/features/store/store-helpers";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://rivendy.com";

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

  /* Date membre */
  const memberSince = seller.created_at
    ? new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
        new Date(seller.created_at as string),
      )
    : null;

  const featured = pickFeatured(activeProducts, 8);
  const completeness = storeCompleteness(seller, products.length > 0);
  const shareUrl = `${SITE_URL}/store/${sellerId}`;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 md:px-6 md:py-8">
      {/* Fil d'Ariane */}
      <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: "Boutique" }, { label: sellerName }]} />

      {/* Bandeau propriétaire — masqué pour les visiteurs */}
      <StoreOwnerBar
        sellerId={seller.id}
        sellerName={sellerName}
        completenessPct={completeness.pct}
        missing={completeness.missing}
      />

      {/* Hero premium */}
      <div id="hero" className="scroll-mt-24">
        <StoreHero
          seller={seller}
          country={country}
          trust={trust}
          pillars={pillars}
          followersCount={followersCount}
          memberSince={memberSince}
          products={products}
        />
      </div>

      {/* Bande de confiance Rivendy */}
      <StoreTrustBar />

      {/* Navigation interne sticky */}
      <StoreNavTabs showFeatured={featured.length > 0} sellerName={sellerName} />

      {/* Sélection vedette */}
      <StoreFeaturedProducts products={featured} country={country} />

      {/* Catalogue complet + colonne latérale À propos */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        <section id="produits" className="scroll-mt-24 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-slate-900">
              Tous les produits
              {activeProducts.length > 0 && (
                <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-bold text-slate-500">
                  {activeProducts.length}
                </span>
              )}
            </h2>
            <PrintCatalog seller={seller} products={products} country={country} />
          </div>

          {activeProducts.length > 0 ? (
            <StoreCatalog products={activeProducts} country={country} />
          ) : (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
              <ShoppingBag className="h-10 w-10 text-slate-200" />
              <p className="mt-3 font-semibold text-slate-500">Aucun produit disponible pour le moment</p>
              <Link href="/" className="mt-4 text-sm font-bold text-[#009688] hover:underline">
                Explorer d&apos;autres boutiques →
              </Link>
            </div>
          )}

          {/* Produits archivés (collapsible, client component) */}
          <UnavailableProducts products={unavailable} />
        </section>

        <StoreAbout seller={seller} country={country} products={products} memberSince={memberSince} shareUrl={shareUrl} />
      </div>

      {/* Avis et évaluations + protection Rivendy */}
      <section id="avis" className="mt-12 scroll-mt-24 border-t border-slate-100 pt-8">
        <h2 className="mb-6 text-xl font-black text-slate-900">Avis de la boutique</h2>
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <StoreRatings sellerId={seller.id} />
          <StoreProtectionCard />
        </div>
      </section>
    </div>
  );
}
