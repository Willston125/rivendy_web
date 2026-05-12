"use client";

import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useCart } from "@/features/cart/cart-provider";
import type { Product } from "@/types/rivendy";

export function BuyNowButton({ product }: { product: Product }) {
  const router = useRouter();
  const { addItem } = useCart();

  return (
    <button
      type="button"
      onClick={() => {
        addItem(product);
        router.push("/checkout");
      }}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-[#25D366] text-sm font-black text-[#25D366] transition-all duration-200 hover:bg-[#25D366] hover:text-white active:scale-[0.98]"
    >
      <MessageCircle className="h-4 w-4" />
      Commander maintenant via Rivendy
    </button>
  );
}
