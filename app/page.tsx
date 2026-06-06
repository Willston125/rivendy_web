import type { Metadata } from "next";
import Link from "next/link";
import { Zap } from "lucide-react";
import { CATEGORIES, SUBCATEGORIES, DEFAULT_COUNTRY_ID, type CategoryId } from "@/types/rivendy";
import { AdBanner } from "@/features/ads/ad-banner";
import { ProductGrid } from "@/features/products/product-grid";
import { StoriesRail } from "@/features/products/stories-rail";
import { LeftSidebar } from "@/components/home/left-sidebar";
import { HeroBanner } from "@/components/home/hero-banner";
import { PromoCards } from "@/components/home/promo-cards";
import { RightSidebar } from "@/components/home/right-sidebar";
import {
  getAdvertisements,
  getCountry,
  getProducts,
  getStoryProducts,
} from "@/services/public-data";
import { cn } from "@/lib/utils/cn";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: HomeSearchParams;
}): Promise<Metadata> {
  const params = await searchParams;
  const countryId = params.country || DEFAULT_COUNTRY_ID;
  const country = await getCountry(countryId);
  return {
    title: `Rivendy — Achetez et vendez à ${country.name}`,
    description: `Rivendy est la marketplace #1 à ${country.name}. Achetez, vendez et commandez des produits locaux en toute sécurité.`,
    openGraph: {
      title: `Rivendy — Marketplace ${country.name}`,
      description:
        "Découvrez des milliers de produits locaux sur Rivendy. Mode, électronique, beauté, alimentation et bien plus.",
      url: "https://rivendy.com",
      siteName: "Rivendy",
      images: [{ url: "/brand/hero-woman.png", width: 1200, height: 630 }],
      locale: "fr_DJ",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Rivendy — Marketplace ${country.name}`,
      description: `Achetez et vendez à ${country.name} avec Rivendy.`,
      images: ["/brand/hero-woman.png"],
    },
  };
}

type HomeSearchParams = Promise<{
  country?: string;
  category?: string;
  subcategory?: string;
  q?: string;
}>;

export default async function HomePage({
  searchParams,
}: {
  searchParams: HomeSearchParams;
}) {
  const params = await searchParams;
  const countryId = params.country || DEFAULT_COUNTRY_ID;
  const category = params.category as CategoryId | undefined;
  const subcategory = params.subcategory;
  const q = params.q;

  const [country, products, ads, inlineAds, stories] = await Promise.all([
    getCountry(countryId),
    getProducts({ countryId, category, subcategory, search: q }),
    getAdvertisements({ countryId, positions: ["web_home_banner", "home_banner"] }),
    getAdvertisements({ countryId, positions: ["web_feed_inline", "feed_inline"] }),
    getStoryProducts(countryId),
  ]);

  const isAlimentation = category === "alimentation";
  const boosted = products.filter((p) => p.status === "boosted").slice(0, 10);
  const recent  = products.filter((p) => p.status !== "boosted");

  const categoryObj   = category ? CATEGORIES.find((c) => c.id === category) : null;
  const categoryLabel = categoryObj?.label ?? category ?? null;
  const subcategories = category ? SUBCATEGORIES[category] ?? [] : [];

  return (
    <div className="mx-auto max-w-[1440px] px-3 py-4 md:px-5 lg:px-6">

      {/* ══════════════════════════════════════════════════════════
          LAYOUT 3 COLONNES
          Left 260px | Main 1fr | Right 300px (xl)
      ══════════════════════════════════════════════════════════ */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[260px_minmax(0,1fr)_300px]">

        {/* ══ SIDEBAR GAUCHE (xl+) ══════════════════════════════ */}
        <LeftSidebar stories={stories} countryId={countryId} />

        {/* ══ COLONNE PRINCIPALE ════════════════════════════════ */}
        <div className="min-w-0 space-y-4 md:space-y-5">

          {/* ── Contexte recherche active ───────────────────────── */}
          {(q || category) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E0F2F1] px-3 py-1 text-xs font-bold text-[#009688]">
                📍 {country.name}
              </span>
              {q && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  &ldquo;{q}&rdquo; · {products.length} résultat{products.length > 1 ? "s" : ""}
                </span>
              )}
              {category && !q && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {categoryLabel} · {products.length} article{products.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

          {/* ── Hero Banner ─────────────────────────────────────── */}
          {!q && !category && <HeroBanner countryName={country.name} />}

          {/* ── Bannière pub Supabase (Home Banner) ─────────────── */}
          {ads.length > 0 && <AdBanner ads={ads} />}

          {/* ── Stories (mobile/tablette — sidebar masquée < xl) ── */}
          {!q && !category && stories.length > 0 && (
            <div className="xl:hidden">
              <h2 className="mb-2 px-1 text-[15px] font-black text-slate-900">Stories</h2>
              <StoriesRail products={stories} limit={12} variant="strip" />
            </div>
          )}

          {/* ── Onglets catégories ──────────────────────────────── */}
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">

            {/* Tout */}
            <Link
              href={`/?country=${countryId}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={cn(
                "shrink-0 rounded-full px-5 py-2 text-[13px] font-bold transition",
                !category
                  ? "bg-[#009688] text-white shadow-sm shadow-[#009688]/20"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-[#009688]/30 hover:text-[#009688]",
              )}
            >
              Tout
            </Link>

            {/* Catégories standard */}
            {CATEGORIES.map((item) => (
              <Link
                key={item.id}
                href={`/?country=${countryId}&category=${item.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={cn(
                  "shrink-0 rounded-full px-5 py-2 text-[13px] font-bold transition",
                  category === item.id
                    ? "bg-[#009688] text-white shadow-sm shadow-[#009688]/20"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-[#009688]/30 hover:text-[#009688]",
                )}
              >
                {item.label}
              </Link>
            ))}

            {/* Onglet Sur commande */}
            <Link
              href="/preorders"
              className="shrink-0 rounded-full border border-slate-200 bg-white px-5 py-2 text-[13px] font-bold text-slate-600 transition hover:border-[#009688]/30 hover:text-[#009688]"
            >
              Sur commande
            </Link>
          </div>

          {/* ── Subcatégories (2e niveau de filtre) ──────────────── */}
          {category && subcategories.length > 0 && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              <Link
                href={`/?country=${countryId}&category=${category}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={cn(
                  "shrink-0 rounded-full px-4 py-1.5 text-[12px] font-bold transition",
                  !subcategory
                    ? "bg-[#1A1A1A] text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-500 hover:border-slate-300",
                )}
              >
                Tout
              </Link>
              {subcategories.map((sub) => (
                <Link
                  key={sub}
                  href={`/?country=${countryId}&category=${category}&subcategory=${encodeURIComponent(sub)}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  className={cn(
                    "shrink-0 rounded-full px-4 py-1.5 text-[12px] font-bold transition",
                    subcategory === sub
                      ? "bg-[#1A1A1A] text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-500 hover:border-slate-300",
                  )}
                >
                  {sub}
                </Link>
              ))}
            </div>
          )}

          {/* ── Cartes promo (Offres · Sur commande) ────────────── */}
          {!q && !category && <PromoCards />}

          {/* ── Produits boostés ────────────────────────────────── */}
          {boosted.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#1A1A1A]">
                    <Zap className="h-3.5 w-3.5 fill-white text-white" />
                  </span>
                  <h2 className="text-[15px] font-black text-slate-900">Produits boostés</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                    {boosted.length}
                  </span>
                </div>
                <Link
                  href="/seller/promo"
                  className="text-[12px] font-semibold text-[#009688] transition hover:underline"
                >
                  Voir tout
                </Link>
              </div>
              <ProductGrid products={boosted} country={country} cols={3} />
            </section>
          )}

          {/* ── Pub inline ────────────────────────────────────────── */}
          {inlineAds.length > 0 && (
            <div>
              <AdBanner ads={inlineAds} />
            </div>
          )}

          {/* ── Section Supermarché (layout spécial) ───────────────── */}
          {isAlimentation && recent.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xl">🛒</span>
                <h2 className="text-[15px] font-black text-slate-900">Supermarché</h2>
                <span className="rounded-full bg-[#E8F5E9] px-2 py-0.5 text-[11px] font-bold text-[#2E7D32]">
                  {recent.length} article{recent.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-3">
                {recent.map((p) => (
                  <Link key={p.id} href={`/products/${p.id}`} className="group flex gap-4 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition hover:shadow-md">
                    {/* Photo grande */}
                    <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {p.photos[0] && (
                        <img src={p.photos[0]} alt={p.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                      )}
                      {p.status === "boosted" && (
                        <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-md bg-[#1A1A1A]">
                          <Zap className="h-3 w-3 fill-white text-white" />
                        </span>
                      )}
                    </div>
                    {/* Infos */}
                    <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                      <div>
                        <h3 className="line-clamp-2 text-sm font-bold text-[#1A1A1A]">{p.title}</h3>
                        {p.package_contents && (
                          <p className="mt-1 line-clamp-1 text-xs text-slate-400">{p.package_contents}</p>
                        )}
                      </div>
                      <div className="mt-auto flex items-end justify-between">
                        <p className="text-lg font-black text-[#007168]">
                          {p.price.toLocaleString("fr-FR")} {country.currency_symbol}
                        </p>
                        {p.stock_quantity > 0 ? (
                          <span className="rounded-full bg-[#E8F5E9] px-2.5 py-1 text-[10px] font-bold text-[#2E7D32]">En stock</span>
                        ) : (
                          <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-500">Épuisé</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── Section Nouveautés / Résultats (layout standard) ──── */}
          {!isAlimentation && (
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <h2 className="text-[15px] font-black text-slate-900">
                {q
                  ? `Résultats pour "${q}"`
                  : category
                  ? categoryLabel
                  : "Nouveautés"}
              </h2>
              {!q && (
                <Link
                  href={`/?country=${countryId}`}
                  className="shrink-0 text-[12px] font-semibold text-[#009688] transition hover:underline"
                >
                  Voir tout
                </Link>
              )}
            </div>
            <ProductGrid
              products={recent}
              country={country}
              cols={3}
              emptyLabel={
                q
                  ? `Aucun résultat pour "${q}" — essaie un autre mot.`
                  : "Aucun produit dans cette catégorie pour le moment."
              }
            />
          </section>
          )}
        </div>

        {/* ══ SIDEBAR DROITE (lg+) ══════════════════════════════ */}
        <RightSidebar />
      </div>
    </div>
  );
}
