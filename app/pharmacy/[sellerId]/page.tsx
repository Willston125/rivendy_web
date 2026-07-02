import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Star, Clock, Bike, Cross, PackageOpen, ClipboardPlus } from "lucide-react";
import { ProductGrid } from "@/features/products/product-grid";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  getCountry,
  getSellerProfile,
  getSellerPublicProducts,
  getStoreTrustSummary,
} from "@/services/public-data";
import {
  dominantPharmacyType,
  PHARMACY_RAYONS,
} from "@/features/products/pharmacy-grouping";
import { isRestaurantOpen } from "@/features/products/restaurant-grouping";
import type { Product } from "@/types/rivendy";

const getSellerProfileCached = cache(getSellerProfile);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sellerId: string }>;
}): Promise<Metadata> {
  const { sellerId } = await params;
  const seller = await getSellerProfileCached(sellerId);
  if (!seller) return { title: "Pharmacie introuvable — Rivendy" };
  const name = seller.store_name || seller.full_name || "Pharmacie Rivendy";
  return {
    title: `${name} — Pharmacie sur Rivendy`,
    description:
      seller.store_description ||
      `Découvrez le catalogue de ${name} : médicaments, hygiène, bébé, bien-être et parapharmacie, à commander sur Rivendy.`,
  };
}

/** Lecture tolérante d'un attribut extra_attributes. */
function attr(p: Product, key: string): string {
  const v = p.extra_attributes?.[key];
  return v == null ? "" : String(v).trim();
}

/**
 * Sections du catalogue, dans l'ordre, dérivées dynamiquement des rayons
 * réellement présents (aucun produit orphelin — miroir du correctif A
 * côté Flutter). « Populaires » (boostés) d'abord, puis chaque rayon présent.
 */
function buildSections(products: Product[]) {
  const boosted = products.filter((p) => p.status === "boosted");
  const sections: { key: string; label: string; items: Product[] }[] = [];
  if (boosted.length > 0) {
    sections.push({ key: "populaires", label: "Populaires", items: boosted });
  }

  // Rayons présents (ordre canonique d'abord, puis tout rayon hors liste).
  const present = new Set<string>();
  for (const p of products) {
    const r = attr(p, "rayon");
    if (r) present.add(r);
  }
  const ordered: string[] = [];
  for (const r of PHARMACY_RAYONS) {
    if (present.delete(r)) ordered.push(r);
  }
  ordered.push(...present);

  for (const rayon of ordered) {
    const items = products.filter((p) => attr(p, "rayon") === rayon);
    if (items.length > 0) {
      sections.push({ key: `rayon-${rayon}`, label: rayon, items });
    }
  }
  return sections;
}

export default async function PharmacyCatalogPage({
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
    (p) => p.status === "active" || p.status === "boosted",
  );

  const name = seller.store_name || seller.full_name || "Pharmacie Rivendy";
  const type = dominantPharmacyType(active);
  const hours = active
    .map((p) => attr(p, "horaires_ouverture"))
    .find((h) => h.length > 0) ?? "";
  const hasDelivery = active.some((p) =>
    attr(p, "livraison").toLowerCase().startsWith("oui"),
  );
  const isOpen = hours.length > 0 && isRestaurantOpen(hours);
  const rating = Number(trust.score ?? 0);

  const bannerSrc = seller.store_banner_url_web || seller.store_banner_url;
  const sections = buildSections(active);

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-8">
      <Breadcrumbs
        items={[
          { label: "Accueil", href: "/" },
          { label: "Pharmacie", href: "/?category=pharmacie" },
          { label: name },
        ]}
      />

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="relative h-40 bg-slate-900 md:h-56">
          {bannerSrc ? (
            <Image src={bannerSrc} alt="" fill sizes="100vw" priority className="object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#009688_0%,#004D40_100%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>

        <div className="px-5 pb-6 md:px-8">
          <div className="-mt-12 flex items-end gap-4">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-[#E0F2F1] shadow-md">
              {seller.avatar_url ? (
                <Image src={seller.avatar_url} alt={name} fill sizes="96px" className="object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-[#009688]">
                  <Cross className="h-8 w-8" />
                </div>
              )}
            </div>
            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black leading-tight text-slate-900 md:text-3xl">
                  {name}
                </h1>
                {seller.is_certified && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#009688] px-2.5 py-0.5 text-[11px] font-black text-white">
                    <BadgeCheck className="h-3 w-3 fill-white" />
                    Certifié
                  </span>
                )}
              </div>
              {type && (
                <p className="mt-1 text-sm font-medium text-slate-500">{type}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[12.5px] font-bold">
                {rating > 0 && (
                  <span className="flex items-center gap-1 text-[#FF6B35]">
                    <Star className="h-3.5 w-3.5 fill-[#FF6B35]" />
                    {rating.toFixed(1)}
                  </span>
                )}
                {hours.length > 0 && (
                  <span
                    className={`flex items-center gap-1 ${isOpen ? "text-[#16A34A]" : "text-slate-400"}`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {isOpen ? "Ouvert" : "Fermé"}
                  </span>
                )}
                {hasDelivery && (
                  <span className="flex items-center gap-1 text-[#009688]">
                    <Bike className="h-3.5 w-3.5" />
                    Livraison
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm font-medium text-slate-500">
            Commandez vos produits de santé et bien-être directement sur Rivendy
          </p>
        </div>
      </section>

      {/* ── Catalogue (sections par rayon) ─────────────────────── */}
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
          <PackageOpen className="h-10 w-10 text-slate-200" />
          <p className="mt-3 font-semibold text-slate-500">
            Aucun produit disponible pour le moment
          </p>
          <Link href="/?category=pharmacie" className="mt-4 text-sm font-bold text-[#009688] hover:underline">
            Découvrir d&apos;autres pharmacies →
          </Link>
        </div>
      )}

      {/* ── Bloc « Ordonnances acceptées via Rivendy » (informatif) ── */}
      <section className="mt-10 rounded-2xl border border-[#009688]/20 bg-[#E0F2F1]/50 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#009688]/10 text-[#007168]">
            <ClipboardPlus className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-black text-slate-900">
              Ordonnances acceptées via Rivendy
            </h3>
            <p className="mt-1 text-[13px] font-medium leading-relaxed text-slate-600">
              Importez votre ordonnance depuis l&apos;application mobile Rivendy et
              recevez vos médicaments en toute simplicité.
            </p>
            <p className="mt-1.5 text-[12px] italic text-slate-500">
              Pour les médicaments soumis à ordonnance, une validation peut être
              nécessaire.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
