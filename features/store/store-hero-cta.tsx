"use client";

import { ShoppingBag } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";

/** Bouton principal visiteur. Masqué pour le propriétaire (il a la barre de gestion). */
export function StoreHeroCta({ sellerId }: { sellerId: string }) {
  const { user } = useAuth();
  if (user && user.id === sellerId) return null;

  const scrollToProducts = () => {
    document.getElementById("produits")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <button
      type="button"
      onClick={scrollToProducts}
      className="inline-flex h-11 items-center gap-2 rounded-full bg-[#009688] px-6 text-sm font-black text-white shadow-sm shadow-[#009688]/25 transition hover:bg-[#00796B] active:scale-95"
    >
      <ShoppingBag className="h-4 w-4" />
      Explorer les produits
    </button>
  );
}
