import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, ChevronRight, MessageCircle, Package, ShieldCheck, Star, Zap } from "lucide-react";
import { ProductActions } from "@/features/products/product-actions";
import { ProductGallery } from "@/features/products/product-gallery";
import { ProductGrid } from "@/features/products/product-grid";
import { ProductComments } from "@/features/products/product-comments";
import { ProductRatingInput } from "@/features/products/product-rating-input";
import { ProductViewTracker } from "@/features/products/product-view-tracker";
import { categoryLabel, formatMoney, isBoosted, isProductVisible } from "@/lib/utils/format";
import { getCountry, getProductById, getSimilarProducts } from "@/services/public-data";

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return { title: "Produit introuvable — Rivendy" };

  const image = Array.isArray(product.photos) && product.photos.length > 0
    ? (product.photos[0] as string)
    : "/brand/hero-woman.png";

  const country = await getCountry(product.seller_country_id || "DJ");
  return {
    title: `${product.title} — Rivendy`,
    description:
      product.description
        ? product.description.slice(0, 155)
        : `Achetez "${product.title}" sur Rivendy, la marketplace #1 à ${country.name}.`,
    openGraph: {
      title: product.title,
      description: product.description?.slice(0, 155) ?? "",
      images: [{ url: image, width: 800, height: 800 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: product.title,
      images: [image],
    },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product || !isProductVisible(product)) notFound();

  const [country, similar] = await Promise.all([
    getCountry(product.seller_country_id || "DJ"),
    getSimilarProducts(product),
  ]);

  const boosted   = isBoosted(product);
  const hasRating = product.average_rating != null && Number(product.average_rating) > 0;
  const rating    = Number(product.average_rating ?? 0);
  const fullStars = Math.floor(rating);
  const hasHalf   = rating - fullStars >= 0.5;

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-8">

      {/* Incrémente views_count — parity Flutter product_detail_screen */}
      <ProductViewTracker productId={product.id} />

      {/* Breadcrumb */}
      <nav className="mb-5 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
        <Link href="/" className="hover:text-[#007168]">Accueil</Link>
        <ChevronRight className="h-3 w-3" />
        <Link
          href={`/?category=${product.category}`}
          className="hover:text-[#007168]"
        >
          {categoryLabel(product.category)}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="line-clamp-1 text-slate-600">{product.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">

        {/* ── GALERIE ──────────────────────────────────────────────── */}
        <ProductGallery photos={product.photos} title={product.title} />

        {/* ── INFOS PRODUIT ────────────────────────────────────────── */}
        <section className="space-y-5">

          {/* Badges statut */}
          <div className="flex flex-wrap gap-2">
            {boosted && (
              <span className="flex items-center gap-1 rounded-full bg-[#1A1A1A] px-3 py-1 text-xs font-black text-white">
                <Zap className="h-3 w-3 fill-white" />
                Produit boosté
              </span>
            )}
            {product.seller_is_certified && (
              <span className="flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-white">
                <BadgeCheck className="h-3 w-3 fill-white" />
                Vendeur certifié
              </span>
            )}
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600">
              {categoryLabel(product.category)}
            </span>
          </div>

          {/* Titre + prix + note */}
          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight text-[#1A1A1A] md:text-4xl">
              {product.title}
            </h1>

            <p className="text-3xl font-black text-[#007168]">
              {formatMoney(product.price, country)}
            </p>

            {/* Note / avis */}
            {hasRating && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < fullStars
                          ? "fill-amber-400 text-amber-400"
                          : i === fullStars && hasHalf
                          ? "fill-amber-200 text-amber-400"
                          : "fill-slate-200 text-slate-200"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm font-bold text-slate-600">
                  {rating.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          {/* Métadonnées : État · Taille · Stock */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-xl bg-white p-3 text-center shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">État</p>
              <p className="mt-1 font-bold text-[#1A1A1A]">{product.condition || "Bon état"}</p>
            </div>
            <div className="rounded-xl bg-white p-3 text-center shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Taille</p>
              <p className="mt-1 font-bold text-[#1A1A1A]">{product.size || "Unique"}</p>
            </div>
            <div className="rounded-xl bg-white p-3 text-center shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Stock</p>
              <p className={`mt-1 font-black ${Number(product.stock_quantity) > 0 ? "text-[#007168]" : "text-red-500"}`}>
                {Number(product.stock_quantity) > 0 ? product.stock_quantity : "Épuisé"}
              </p>
            </div>
          </div>

          {/* Variantes déclarées (tailles / couleurs) — parity app */}
          {(() => {
            const csv = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
            const sizes = csv(product.extra_attributes?.sizes);
            const colors = csv(product.extra_attributes?.colors);
            if (sizes.length === 0 && colors.length === 0) return null;
            return (
              <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
                {sizes.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Tailles disponibles</p>
                    <div className="flex flex-wrap gap-2">
                      {sizes.map((s) => (
                        <span key={s} className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-bold text-slate-700">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {colors.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Couleurs disponibles</p>
                    <div className="flex flex-wrap gap-2">
                      {colors.map((c) => (
                        <span key={c} className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-bold text-slate-700">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-slate-400">Précisez votre choix de taille / couleur lors de la commande.</p>
              </div>
            );
          })()}

          {/* Livraison estimée */}
          {product.delivery_days != null && product.delivery_days > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm shadow-sm">
              <Package className="h-4 w-4 shrink-0 text-[#007168]" />
              <span className="font-semibold text-slate-600">
                Livraison estimée : <span className="font-black text-[#1A1A1A]">{product.delivery_days} jour{product.delivery_days > 1 ? "s" : ""}</span>
              </span>
            </div>
          )}

          {/* Saisie de note */}
          <ProductRatingInput productId={product.id} />

          {/* Description */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-base font-black text-[#1A1A1A]">Description</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
              {product.description || "Le vendeur n'a pas ajouté de description."}
            </p>
          </div>

          {/* Bloc vendeur */}
          <Link
            href={`/store/${product.seller_id}`}
            className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm transition hover:bg-slate-50"
          >
            {/* Avatar */}
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[#E0F2F1]">
              {product.seller_avatar_url ? (
                <Image
                  src={product.seller_avatar_url}
                  alt={product.seller_name || ""}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-black text-[#007168]">
                  {(product.seller_name || "R").slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            {/* Infos vendeur */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="font-black text-[#1A1A1A]">
                  {product.seller_name || "Boutique Rivendy"}
                </p>
                {product.seller_is_certified && (
                  <BadgeCheck className="h-4 w-4 shrink-0 text-amber-400" />
                )}
              </div>
              <p className="text-xs text-slate-400">Voir la boutique et le trust score</p>
            </div>

            <ShieldCheck className="h-5 w-5 shrink-0 text-[#007168]" />
          </Link>

          {/* Bannière protection */}
          <div className="flex items-start gap-3 rounded-2xl border border-[#B2DFDB] bg-[#E0F2F1] p-4 text-sm font-semibold text-[#007168]">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Les coordonnées du vendeur ne sont pas affichées. La commande passe par Rivendy — les deux parties sont protégées.
          </div>

          {/* Actions — masque commande si c'est le vendeur (parity Flutter) */}
          <ProductActions product={product} />
        </section>
      </div>

      {/* Section Commentaires */}
      <section className="mt-12">
        <ProductComments
          productId={product.id}
          sellerId={product.seller_id}
          productTitle={product.title}
          productImage={Array.isArray(product.photos) && product.photos.length > 0 ? product.photos[0] : ""}
        />
      </section>

      {/* Produits similaires */}
      {similar.length > 0 && (
        <section className="mt-12 space-y-4">
          <div>
            <h2 className="text-xl font-black text-[#1A1A1A]">Produits similaires</h2>
            <p className="text-sm text-slate-500">Dans la même catégorie · {country.name}</p>
          </div>
          <ProductGrid
            products={similar}
            country={country}
            cols={4}
            emptyLabel="Aucun produit similaire pour le moment."
          />
        </section>
      )}
    </div>
  );
}
