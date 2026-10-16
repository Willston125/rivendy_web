"use client";

import { Heart } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/features/auth/auth-provider";
import { useFavorites } from "@/features/products/favorites-provider";

/**
 * Cœur « favori ». L'état vient de FavoritesProvider, lu une seule fois pour
 * tout le site (audit 17, WEB-2) : plus aucune requête par carte.
 */
export function FavoriteButton({ productId, className }: { productId: string; className?: string }) {
  const { user } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const favorite = Boolean(user) && isFavorite(productId);

  async function onToggle() {
    if (!user) {
      router.push("/auth/login");
      return;
    }
    setBusy(true);
    try {
      await toggle(productId);
    } catch {
      // Refus de la base : le fournisseur a déjà remis le cœur dans son état d'avant.
    } finally {
      setBusy(false);
    }
  }

  if (className) {
    return (
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        aria-label={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
        className={cn(className, busy && "opacity-50")}
      >
        <Heart className={cn("h-4 w-4 transition", favorite && "fill-rose-500")} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-label={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-200 active:scale-95",
        favorite
          ? "border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100"
          : "border-slate-200 bg-white text-slate-400 hover:border-rose-200 hover:text-rose-400",
        busy && "opacity-50",
      )}
    >
      <Heart className={cn("h-4 w-4 transition", favorite && "fill-rose-500")} />
    </button>
  );
}
