"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { AddToCartButton } from "@/features/products/add-to-cart-button";
import { FavoriteButton } from "@/features/products/favorite-button";
import type { Product } from "@/types/rivendy";

/**
 * Cœur favori en overlay — masqué si l'utilisateur est le vendeur du produit
 * (on ne met pas ses propres annonces en favori).
 */
export function ProductCardFavorite({ productId, sellerId }: { productId: string; sellerId: string }) {
  const { user } = useAuth();
  if (user && user.id === sellerId) return null;
  return (
    <FavoriteButton
      productId={productId}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-red-500"
    />
  );
}

/**
 * Action de bas de carte produit.
 * Parity Flutter : on ne commande pas ses propres produits → si l'utilisateur
 * connecté est le vendeur, on remplace "Ajouter au panier" par "Gérer mon
 * annonce" (lien d'édition). Sinon, bouton panier normal.
 */
export function ProductCardAction({ product }: { product: Product }) {
  const { user } = useAuth();
  const isOwner = !!user && user.id === product.seller_id;

  if (isOwner) {
    return (
      <Link
        href={`/seller/products/${product.id}/edit`}
        className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#6A5ACD]/30 bg-[#6A5ACD]/5 text-[11px] font-bold text-[#6A5ACD] transition hover:bg-[#6A5ACD]/10"
      >
        <Pencil className="h-3.5 w-3.5" />
        Gérer mon annonce
      </Link>
    );
  }

  return (
    <AddToCartButton
      product={product}
      label="Ajouter au panier"
      size="sm"
      className="h-9 w-full rounded-xl bg-[#009688] text-[11px] font-bold whitespace-nowrap hover:bg-[#00796B]"
    />
  );
}
