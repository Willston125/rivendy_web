"use client";

import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useCart } from "@/features/cart/cart-provider";
import { useForeignMarketGuard } from "@/features/checkout/foreign-market-order";
import { BUY_NOW_KEY } from "@/features/checkout/checkout-form";
import type { Product } from "@/types/rivendy";

export function BuyNowButton({ product }: { product: Product }) {
  const router = useRouter();
  const { addItem } = useCart();
  // 🌍 2026-10-03 : pas de commande hors du marché d'origine du compte.
  const marketGuard = useForeignMarketGuard();

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          if (!(await marketGuard.allows([product.country_id]))) return;
          // Comme l'app : « Commander maintenant » commande CET article seul.
          // Il voyage hors du panier — l'ancien bouton l'y ajoutait puis
          // commandait tout le panier.
          try {
            sessionStorage.setItem(BUY_NOW_KEY, JSON.stringify({ product, quantity: 1 }));
            router.push("/checkout?buy-now=1");
          } catch {
            // Stockage indisponible : repli sur le panier, comme avant.
            addItem(product);
            router.push("/checkout");
          }
        }}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-[#25D366] text-sm font-black text-[#25D366] transition-all duration-200 hover:bg-[#25D366] hover:text-white active:scale-[0.98]"
      >
        <MessageCircle className="h-4 w-4" />
        Commander maintenant via Rivendy
      </button>
      {marketGuard.dialog}
    </>
  );
}
