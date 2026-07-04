"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import type { Product } from "@/types/rivendy";
import { AddToCartButton } from "@/features/products/add-to-cart-button";
import { BuyNowButton } from "@/features/checkout/buy-now-button";
import { FavoriteButton } from "@/features/products/favorite-button";
import { ShareButton } from "@/components/ui/share-button";
import { ReportButton } from "@/features/products/report-button";
import { RentalRequestForm } from "@/features/products/rental-request-form";

/**
 * Bloc d'actions produit. Parity Flutter : si l'utilisateur connecté est le
 * vendeur, on masque "Ajouter au panier / Commander" (on ne commande pas ses
 * propres produits) et on propose "Modifier l'annonce" à la place.
 */
export function ProductActions({ product }: { product: Product }) {
  const { user } = useAuth();
  const isOwner = !!user && user.id === product.seller_id;

  if (isOwner) {
    return (
      <div className="space-y-2">
        <div className="rounded-2xl border border-[#6A5ACD]/25 bg-[#6A5ACD]/5 p-4 text-sm font-semibold text-[#6A5ACD]">
          C&apos;est votre annonce — vous ne pouvez pas commander vos propres produits.
        </div>
        <Link
          href={`/seller/products/${product.id}/edit`}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#6A5ACD] text-sm font-black text-white transition hover:bg-[#5849b5]"
        >
          <Pencil className="h-4 w-4" />
          Modifier mon annonce
        </Link>
        <div className="flex gap-2">
          <ShareButton
            title={product.title}
            text={`Regarde ${product.title} sur Rivendy !`}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-600 transition hover:bg-slate-50"
          />
        </div>
      </div>
    );
  }

  // Location : pas de panier — demande traitée par l'agence Rivendy (parité app).
  const isRental = product.category === "location";

  return (
    <div className="space-y-2">
      {isRental ? (
        <div className="flex gap-2">
          <div className="flex-1">
            <RentalRequestForm product={product} />
          </div>
          <FavoriteButton
            productId={product.id}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-400"
          />
          <ShareButton
            title={product.title}
            text={`Regarde ${product.title} sur Rivendy !`}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
          />
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <AddToCartButton product={product} label="Ajouter au panier" size="lg" />
            <FavoriteButton
              productId={product.id}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-400"
            />
            <ShareButton
              title={product.title}
              text={`Regarde ${product.title} sur Rivendy !`}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            />
          </div>
          <BuyNowButton product={product} />
        </>
      )}
      <ReportButton targetId={product.id} />
    </div>
  );
}
