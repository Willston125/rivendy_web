import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Star, MapPin, Truck, HardHat } from "lucide-react";
import { ProductGrid } from "@/features/products/product-grid";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  getCountry,
  getSellerProfile,
  getSellerPublicProducts,
  getStoreTrustSummary,
} from "@/services/public-data";
import { CONSTRUCTION_MATERIALS, constructionMaterialLabel } from "@/features/products/construction-listings";
import type { Product } from "@/types/rivendy";

const getSellerProfileCached = cache(getSellerProfile);

function attr(p: Product, key: string): string {
  const v = p.extra_attributes?.[key];
  return v == null ? "" : String(v).trim();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sellerId: string }>;
}): Promise<Metadata> {
  const { sellerId } = await params;
  const seller = await getSellerProfileCached(sellerId);
  if (!seller) return { title: "Fournisseur introuvable — Rivendy" };
  const name = seller.store_name || seller.full_name || "Fournisseur Rivendy";
  return {
    title: `${name} — Matériaux de construction sur Rivendy`,
    description:
      seller.store_description ||
      `Découvrez le catalogue de ${name} et commandez vos matériaux sur Rivendy.`,
  };
}

/** Sections du catalogue : Populaires (boostés), puis un rayon par matériau
 * réellement présent, dans l'ordre canonique CONSTRUCTION_MATERIALS. */
function buildSections(products: Product[]) {
  const boosted = products.filter((p) => p.category === "materiauxConstruction" && p.status === "boosted");
  const sections: { key: string; label: string; items: Product[] }[] = [
    { key: "populaires", label: "Populaires", items: boosted },
  ];
  for (const m of CONSTRUCTION_MATERIALS) {
    sections.push({
      key: m.key,
      label: m.label,
      items: products.filter((p) => p.subcategory === m.key),
    });
  }
  return sections.filter((s) => s.items.length > 0);
}

export default async function ConstructionCatalogPage({
  params,
}: {
  params: Promise<{ sellerId: string }>;
}) {
  const { sellerId } = await params;

  const seller = await getSellerProfileCached(sellerId);
  if (!seller) notFound();

  const [products, trust, country] = await Promise.all([
    getSellerPublicProducts(sellerId, false),
    getStoreTrustSummary(sellerId),
    getCountry(seller.country_id || "DJ"),
  ]);

  const active = products.filter(
    (p) => p.category === "materiauxConstruction" && (p.status === "active" || p.status === "boosted"),
  );

  const name = seller.store_name || seller.full_name || "Fournisseur Rivendy";
  const rating = Number(trust.score ?? 0);
  const hasDelivery = active.some((p) => attr(p, "livraison").toLowerCase().startsWith("oui"));
  const specialties: string[] = [];
  for (const p of active) {
    const label = constructionMaterialLabel(p.subcategory);
    if (label && !specialties.includes(label)) specialties.push(label);
    if (specialties.length >= 3) break;
  }

  const bannerSrc = seller.store_banner_url_web || seller.store_banner_url;
  const sections = buildSections(active);

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-8">
      <Breadcrumbs
        items={[
          { label: "Accueil", href: "/" },
          { label: "Construction", href: "/?category=materiauxConstruction" },
          { label: name },
        ]}
      />

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="relative h-32 bg-slate-900 md:h-44">
          {bannerSrc ? (
            <Image src={bannerSrc} alt="" fill sizes="100vw" priority className="object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#009688_0%,#004D40_100%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>

        <div className="px-5 pb-6 md:px-8">
          <div className="-mt-10 flex items-end gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-[#E0F2F1] shadow-md">
              {seller.avatar_url ? (
                <Image src={seller.avatar_url} alt={name} fill sizes="80px" className="object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-[#009688]">
                  <HardHat className="h-7 w-7" />
                </div>
              )}
            </div>
            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black leading-tight text-slate-900 md:text-2xl">{name}</h1>
                {seller.is_certified && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#009688] px-2.5 py-0.5 text-[11px] font-black text-white">
                    <BadgeCheck className="h-3 w-3 fill-white" />
                    Certifié
                  </span>
                )}
              </div>
              {specialties.length > 0 && (
                <p className="mt-1 text-sm font-medium text-slate-500">{specialties.join(" · ")}</p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[12.5px] font-bold">
                {rating > 0 && (
                  <span className="flex items-center gap-1 text-[#FF6B35]">
                    <Star className="h-3.5 w-3.5 fill-[#FF6B35]" />
                    {rating.toFixed(1)}
                  </span>
                )}
                {hasDelivery && (
                  <span className="flex items-center gap-1 text-[#009688]">
                    <Truck className="h-3.5 w-3.5" />
                    Livraison
                  </span>
                )}
              </div>
            </div>
          </div>
          {seller.store_description && (
            <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-500">{seller.store_description}</p>
          )}
        </div>
      </section>

      {/* ── Catalogue (sections par matériau) ──────────────────── */}
      {sections.length > 0 ? (
        <div className="mt-8 space-y-10">
          {sections.map((s) => (
            <section key={s.key} className="space-y-4">
              <h2 className="text-xl font-black text-slate-900">
                {s.label}
                <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-bold text-slate-500">
                  {s.items.length}
                </span>
              </h2>
              <ProductGrid products={s.items} country={country} cols={4} />
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <MapPin className="h-10 w-10 text-slate-200" />
          <p className="mt-3 font-semibold text-slate-500">Aucun matériau disponible pour le moment</p>
          <Link href="/?category=materiauxConstruction" className="mt-4 text-sm font-bold text-[#009688] hover:underline">
            Découvrir d&apos;autres fournisseurs →
          </Link>
        </div>
      )}
    </div>
  );
}
