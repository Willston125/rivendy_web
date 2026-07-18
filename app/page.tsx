import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Zap } from "lucide-react";
import { UniverseGrid } from "@/components/home/universe-grid";
import { CATEGORIES, SUBCATEGORIES, DEFAULT_COUNTRY_ID, type CategoryId } from "@/types/rivendy";
import { AdCarousel } from "@/features/ads/ad-carousel";
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
  getStoreBannersFor,
  getStoreRatingsFor,
  getStoryProducts,
  type ProductSort,
} from "@/services/public-data";
import { CatalogToolbar } from "@/features/products/catalog-toolbar";
import { groupRestaurants, RESTAURANT_FILTERS, RESTAURANT_FILTER_ALL, RESTAURANT_TYPE_FILTERS } from "@/features/products/restaurant-grouping";
import { RestaurantHome } from "@/features/products/restaurant-home";
import { groupPharmacies, PHARMACY_FILTERS, PHARMACY_FILTER_ALL } from "@/features/products/pharmacy-grouping";
import { PharmacyEstablishmentCard } from "@/features/products/pharmacy-establishment-card";
import { filterLocationByChip, presentLocationChips } from "@/features/products/location-listings";
import { LocationHome } from "@/features/products/location-home";
import { filterWeddingByChip, presentWeddingChips } from "@/features/products/wedding-listings";
import { WeddingHome } from "@/features/products/wedding-home";
import { groupHotels, HOTEL_FILTERS, HOTEL_FILTER_ALL } from "@/features/products/hotel-listings";
import { HotelCard } from "@/features/products/hotel-card";
import { FoodPackageCard } from "@/features/products/food-package-card";
import {
  groupConstructionCompanies,
  CONSTRUCTION_MATERIALS,
  CONSTRUCTION_FILTER_ALL,
  CONSTRUCTION_FILTER_PROMOS,
  CONSTRUCTION_FILTER_DELIVERY,
} from "@/features/products/construction-listings";
import { ConstructionCompanyCard } from "@/features/products/construction-company-card";
import { BannerAdCarousel } from "@/features/ads/banner-ad-carousel";
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
      url: "https://www.rivendy.com",
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
  priceMin?: string;
  priceMax?: string;
  sort?: string;
  resType?: string;
  locType?: string;
  hotelType?: string;
  pharmaRayon?: string;
  constrType?: string;
  wedType?: string;
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
  const resType = params.resType;
  const locType = params.locType;
  const hotelType = params.hotelType;
  const pharmaRayon = params.pharmaRayon;
  const constrType = params.constrType;
  const wedType = params.wedType;
  const q = params.q;
  const priceMin = params.priceMin ? Number(params.priceMin) : undefined;
  const priceMax = params.priceMax ? Number(params.priceMax) : undefined;
  const sort = (["recent", "price_asc", "price_desc"].includes(params.sort ?? "")
    ? params.sort
    : "recent") as ProductSort;

  const [country, products, ads, inlineAds, promoAds, stories] = await Promise.all([
    getCountry(countryId),
    getProducts({ countryId, category, subcategory, search: q, priceMin, priceMax, sort }),
    getAdvertisements({ countryId, positions: ["web_home_banner", "home_banner"] }),
    getAdvertisements({ countryId, positions: ["web_feed_inline"] }),
    getAdvertisements({ countryId, positions: ["web_promo_offers", "web_promo_preorder", "web_restaurant_banner", "web_category_banner"] }),
    getStoryProducts(countryId),
  ]);

  // Slots promo accueil — 1 affiche max par emplacement (1ère active par display_order)
  const offersAd = promoAds.find((a) => a.position === "web_promo_offers") ?? null;
  const preorderAd = promoAds.find((a) => a.position === "web_promo_preorder") ?? null;
  const restaurantBannerAds = promoAds.filter((a) => a.position === "web_restaurant_banner");
  // Bannières d'onglet ciblées : uniquement celles dont la cible = onglet courant
  const categoryBannerAds = category
    ? promoAds.filter((a) => a.position === "web_category_banner" && a.target_category === category)
    : [];

  const isAlimentation = category === "alimentation";
  const isRestaurant = category === "restaurant";
  const isLocation = category === "location";
  const restaurantGroups = isRestaurant
    ? groupRestaurants(products, resType ?? RESTAURANT_FILTER_ALL)
    : [];
  // Notes ⭐ réelles des boutiques affichées (1 requête groupée ; map vide si
  // aucun avis — la carte n'affiche alors pas de note, spec « que du réel »).
  const [restaurantRatings, restaurantBanners] = isRestaurant
    ? await Promise.all([
        getStoreRatingsFor(restaurantGroups.map((g) => g.sellerId)),
        getStoreBannersFor(restaurantGroups.map((g) => g.sellerId)),
      ])
    : [{}, {}];
  // Chips : « Tous » + UNIQUEMENT les types présents + filtres dérivés.
  const presentResTypes = new Set(
    restaurantGroups.map((g) => g.etablissementType).filter(Boolean),
  );
  const visibleRestaurantFilters = RESTAURANT_FILTERS.filter(
    (f) =>
      !(RESTAURANT_TYPE_FILTERS as readonly string[]).includes(f) ||
      presentResTypes.has(f),
  );
  // Chips remappées (mix 2026-07-18 : Motos séparées, Disponible, présence).
  const locationOffers = isLocation
    ? filterLocationByChip(products, locType ?? "tous")
    : [];
  const locationChips = isLocation ? presentLocationChips(products) : [];
  const isHotel = category === "hotel";
  const hotelSummaries = isHotel
    ? groupHotels(products, hotelType ?? HOTEL_FILTER_ALL)
    : [];
  const isPharmacy = category === "pharmacie";
  const pharmacyGroups = isPharmacy
    ? groupPharmacies(products, pharmaRayon ?? PHARMACY_FILTER_ALL)
    : [];
  const isConstruction = category === "materiauxConstruction";
  const isWedding = category === "mariage";
  const weddingOffers = isWedding ? filterWeddingByChip(products, wedType ?? "tous") : [];
  const weddingChips = isWedding ? presentWeddingChips(products) : [];
  const constructionCompanies = isConstruction
    ? groupConstructionCompanies(products, constrType ?? CONSTRUCTION_FILTER_ALL)
    : [];
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

          {/* ── Bannière du haut (emplacement unique) ─────────────
              Affiches pub publiées (carrousel) si présentes,
              sinon la hero « Achetez/vendez » par défaut. ── */}
          {!q && !category && (
            ads.length > 0
              ? <AdCarousel ads={ads} />
              : <HeroBanner countryName={country.name} countryId={country.id} />
          )}

          {/* ── Stories (mobile/tablette — sidebar masquée < xl) ── */}
          {!q && !category && stories.length > 0 && (
            <div className="xl:hidden">
              <h2 className="mb-2 px-1 text-[15px] font-black text-slate-900">Stories</h2>
              <StoriesRail products={stories} limit={12} variant="strip" />
            </div>
          )}

          {/* ── Navigation : grille d'univers (Tout) OU retour + libellé ── */}
          {!category ? (
            <UniverseGrid countryId={countryId} q={q} />
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href={`/?country=${countryId}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-2 text-[12.5px] font-bold text-slate-600 transition hover:bg-slate-200"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Tous les univers
              </Link>
              <h1 className="truncate text-[17px] font-black text-slate-900">{categoryLabel}</h1>
            </div>
          )}

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

          {/* ── Filtres Restaurant (type d'établissement) ─────────── */}
          {isRestaurant && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {visibleRestaurantFilters.map((value) => {
                const active =
                  (!resType && value === RESTAURANT_FILTER_ALL) || resType === value;
                const href =
                  value === RESTAURANT_FILTER_ALL
                    ? `/?country=${countryId}&category=restaurant`
                    : `/?country=${countryId}&category=restaurant&resType=${encodeURIComponent(value)}`;
                return (
                  <Link
                    key={value}
                    href={href}
                    className={cn(
                      "shrink-0 rounded-full px-4 py-1.5 text-[12px] font-bold transition",
                      active
                        ? "bg-[#009688] text-white shadow-sm shadow-[#009688]/20"
                        : "border border-slate-200 bg-white text-slate-500 hover:border-[#009688]/30 hover:text-[#009688]",
                    )}
                  >
                    {value}
                  </Link>
                );
              })}
            </div>
          )}

          {/* ── Filtres Location (catégories) ─────────────────────── */}
          {isLocation && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {locationChips.map((c) => {
                const active = (!locType && c.id === "tous") || locType === c.id;
                const href = c.id === "tous"
                  ? `/?country=${countryId}&category=location`
                  : `/?country=${countryId}&category=location&locType=${c.id}`;
                return (
                  <Link
                    key={c.id || "all"}
                    href={href}
                    className={cn(
                      "shrink-0 rounded-full px-4 py-1.5 text-[12px] font-bold transition",
                      active
                        ? "bg-[#009688] text-white shadow-sm shadow-[#009688]/20"
                        : "border border-slate-200 bg-white text-slate-500 hover:border-[#009688]/30 hover:text-[#009688]",
                    )}
                  >
                    {c.label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* ── Filtres Mariage (types de prestataires) ───────────── */}
          {isWedding && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {weddingChips.map((c) => {
                const active = (!wedType && c.id === "tous") || wedType === c.id;
                const href = c.id === "tous"
                  ? `/?country=${countryId}&category=mariage`
                  : `/?country=${countryId}&category=mariage&wedType=${c.id}`;
                return (
                  <Link
                    key={c.id || "all"}
                    href={href}
                    className={cn(
                      "shrink-0 rounded-full px-4 py-1.5 text-[12px] font-bold transition",
                      active
                        ? "bg-[#009688] text-white shadow-sm shadow-[#009688]/20"
                        : "border border-slate-200 bg-white text-slate-500 hover:border-[#009688]/30 hover:text-[#009688]",
                    )}
                  >
                    {c.label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* ── Filtres Hôtels (ambiances) ────────────────────────── */}
          {isHotel && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {HOTEL_FILTERS.map((value) => {
                const active = (!hotelType && value === HOTEL_FILTER_ALL) || hotelType === value;
                const href = value === HOTEL_FILTER_ALL
                  ? `/?country=${countryId}&category=hotel`
                  : `/?country=${countryId}&category=hotel&hotelType=${encodeURIComponent(value)}`;
                return (
                  <Link
                    key={value}
                    href={href}
                    className={cn(
                      "shrink-0 rounded-full px-4 py-1.5 text-[12px] font-bold transition",
                      active
                        ? "bg-[#009688] text-white shadow-sm shadow-[#009688]/20"
                        : "border border-slate-200 bg-white text-slate-500 hover:border-[#009688]/30 hover:text-[#009688]",
                    )}
                  >
                    {value}
                  </Link>
                );
              })}
            </div>
          )}

          {/* ── Filtres Pharmacie (rayons produits) ───────────────── */}
          {isPharmacy && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {PHARMACY_FILTERS.map((value) => {
                const active =
                  (!pharmaRayon && value === PHARMACY_FILTER_ALL) || pharmaRayon === value;
                const href =
                  value === PHARMACY_FILTER_ALL
                    ? `/?country=${countryId}&category=pharmacie`
                    : `/?country=${countryId}&category=pharmacie&pharmaRayon=${encodeURIComponent(value)}`;
                return (
                  <Link
                    key={value}
                    href={href}
                    className={cn(
                      "shrink-0 rounded-full px-4 py-1.5 text-[12px] font-bold transition",
                      active
                        ? "bg-[#009688] text-white shadow-sm shadow-[#009688]/20"
                        : "border border-slate-200 bg-white text-slate-500 hover:border-[#009688]/30 hover:text-[#009688]",
                    )}
                  >
                    {value}
                  </Link>
                );
              })}
            </div>
          )}

          {/* ── Filtres Construction (matériaux + promos/livraison) ──── */}
          {isConstruction && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {[
                { key: CONSTRUCTION_FILTER_ALL, label: "Tous" },
                ...CONSTRUCTION_MATERIALS.map((m) => ({ key: m.key, label: m.label })),
                { key: CONSTRUCTION_FILTER_PROMOS, label: "Promotions" },
                { key: CONSTRUCTION_FILTER_DELIVERY, label: "Livraison" },
              ].map((f) => {
                const active = (!constrType && f.key === CONSTRUCTION_FILTER_ALL) || constrType === f.key;
                const href =
                  f.key === CONSTRUCTION_FILTER_ALL
                    ? `/?country=${countryId}&category=materiauxConstruction`
                    : `/?country=${countryId}&category=materiauxConstruction&constrType=${encodeURIComponent(f.key)}`;
                return (
                  <Link
                    key={f.key}
                    href={href}
                    className={cn(
                      "shrink-0 rounded-full px-4 py-1.5 text-[12px] font-bold transition",
                      active
                        ? "bg-[#009688] text-white shadow-sm shadow-[#009688]/20"
                        : "border border-slate-200 bg-white text-slate-500 hover:border-[#009688]/30 hover:text-[#009688]",
                    )}
                  >
                    {f.label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* ── Bannière pub d'onglet (ciblée, dashboard) — jamais sur l'accueil ── */}
          {categoryBannerAds.length > 0 && (
            <BannerAdCarousel ads={categoryBannerAds} fallbackHref={`/?category=${category}`} />
          )}

          {/* ── Barre catalogue (tri + prix) — mode filtre actif ── */}
          {(category || q) && !isRestaurant && !isLocation && !isHotel && !isPharmacy && !isConstruction && !isWedding && (
            <CatalogToolbar
              resultCount={products.length}
              currencySymbol={country.currency_symbol}
            />
          )}

          {/* ── Cartes promo (Offres · Sur commande) — pilotables dashboard ── */}
          {!q && !category && <PromoCards offersAd={offersAd} preorderAd={preorderAd} />}

          {/* ── Section Location (offre-first) ────────────────────── */}
          {isLocation && (
            <LocationHome offers={locationOffers} country={country} />
          )}

          {/* ── Section Mariage (prestataire-first) ───────────────── */}
          {isWedding && (
            <WeddingHome offers={weddingOffers} country={country} />
          )}

          {/* ── Section Hôtels (hôtel-first) ──────────────────────── */}
          {isHotel && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-[15px] font-black text-slate-900">Hôtels recommandés</h2>
                <span className="rounded-full bg-[#E0F2F1] px-2 py-0.5 text-[11px] font-bold text-[#007168]">
                  {hotelSummaries.length} hôtel{hotelSummaries.length > 1 ? "s" : ""}
                </span>
              </div>
              {hotelSummaries.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {hotelSummaries.map((h) => (
                    <HotelCard key={h.sellerId || h.sellerName} hotel={h} country={country} />
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-slate-100 bg-white p-6 text-center text-sm font-semibold text-slate-500">
                  Aucun hôtel disponible pour ce filtre.
                </p>
              )}
            </section>
          )}

          {/* ── Section Construction (fournisseur-first) ──────────── */}
          {isConstruction && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-[15px] font-black text-slate-900">Fournisseurs recommandés</h2>
                <span className="rounded-full bg-[#E0F2F1] px-2 py-0.5 text-[11px] font-bold text-[#007168]">
                  {constructionCompanies.length} fournisseur{constructionCompanies.length > 1 ? "s" : ""}
                </span>
              </div>
              {constructionCompanies.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {constructionCompanies.map((c) => (
                    <ConstructionCompanyCard key={c.sellerId || c.sellerName} company={c} />
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-slate-100 bg-white p-6 text-center text-sm font-semibold text-slate-500">
                  Aucun fournisseur disponible pour ce filtre.
                </p>
              )}
            </section>
          )}

          {/* ── Produits boostés ────────────────────────────────── */}
          {boosted.length > 0 && !isRestaurant && !isLocation && !isHotel && !isPharmacy && !isConstruction && !isWedding && (
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

          {/* ── Section Supermarché — Cartons alimentaires (parité app) ── */}
          {isAlimentation && recent.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xl">🛒</span>
                <h2 className="text-[15px] font-black text-slate-900">Cartons alimentaires</h2>
                <span className="rounded-full bg-[#E8F5E9] px-2 py-0.5 text-[11px] font-bold text-[#2E7D32]">
                  {recent.length} article{recent.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {recent.map((p) => (
                  <FoodPackageCard key={p.id} product={p} country={country} />
                ))}
              </div>
            </section>
          )}

          {/* ── Section Restaurants (établissement d'abord) ───────── */}
          {isRestaurant && (
            <section>
              {/* Bannière hero : carrousel pub dashboard si dispo, sinon défaut */}
              {restaurantBannerAds.length > 0 ? (
                <BannerAdCarousel ads={restaurantBannerAds} storeOpensRestaurant fallbackHref="/?category=restaurant" />
              ) : (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-[#009688] to-[#007168] p-5">
                  <div>
                    <p className="text-lg font-black text-white">Faim maintenant ?</p>
                    <p className="mt-0.5 text-[12.5px] font-medium text-white/85">
                      Découvrez les meilleurs restaurants sur Rivendy
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#FF6B35] px-3.5 py-1.5 text-[12.5px] font-bold text-white">
                      Commandez vos plats préférés
                    </span>
                  </div>
                  <span className="hidden text-4xl sm:block">🍽️</span>
                </div>
              )}
              <RestaurantHome
                groups={restaurantGroups}
                ratings={restaurantRatings}
                banners={restaurantBanners}
              />
            </section>
          )}

          {/* ── Section Pharmacie (établissement d'abord) ─────────── */}
          {isPharmacy && (
            <section>
              <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-[#009688] to-[#007168] p-5">
                <div>
                  <p className="text-lg font-black text-white">Votre santé, simplement avec Rivendy</p>
                  <p className="mt-0.5 text-[12.5px] font-medium text-white/85">
                    Médicaments du quotidien, hygiène, bébé, bien-être et plus encore
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#FF6B35] px-3.5 py-1.5 text-[12.5px] font-bold text-white">
                    Explorer la pharmacie
                  </span>
                </div>
                <span className="hidden text-4xl sm:block">💊</span>
              </div>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-[15px] font-black text-slate-900">Pharmacies recommandées</h2>
                <span className="rounded-full bg-[#E0F2F1] px-2 py-0.5 text-[11px] font-bold text-[#007168]">
                  {pharmacyGroups.length} pharmacie{pharmacyGroups.length > 1 ? "s" : ""}
                </span>
              </div>
              {pharmacyGroups.length > 0 ? (
                <div className="space-y-3">
                  {pharmacyGroups.map((group) => (
                    <PharmacyEstablishmentCard key={group.sellerId || group.sellerName} group={group} />
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-slate-100 bg-white p-6 text-center text-sm font-semibold text-slate-500">
                  Aucune pharmacie disponible pour ce filtre.
                </p>
              )}
            </section>
          )}

          {/* ── Section Nouveautés / Résultats (layout standard) ──── */}
          {!isAlimentation && !isRestaurant && !isLocation && !isHotel && !isPharmacy && !isConstruction && !isWedding && (
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
              inlineAds={inlineAds}
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
