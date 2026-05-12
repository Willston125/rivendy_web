"use client";

import { Check, ShoppingBag } from "lucide-react";
import { useCart } from "@/features/cart/cart-provider";
import { cn } from "@/lib/utils/cn";
import type { Product } from "@/types/rivendy";

export function AddToCartButton({
  product,
  label = "Ajouter",
  size = "default",
  className,
}: {
  product: Product;
  label?: string;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  const { addItem, quantityOf } = useCart();
  const qty = quantityOf(product.id);
  const inCart = qty > 0;

  const sizeClasses = {
    sm:      "h-8 px-3 text-xs gap-1.5",
    default: "h-10 px-4 text-sm gap-2",
    lg:      "h-12 px-5 text-sm gap-2",
  };

  return (
    <button
      type="button"
      onClick={() => addItem(product)}
      className={cn(
        "inline-flex flex-1 items-center justify-center rounded-xl font-bold transition-all duration-200 active:scale-95",
        sizeClasses[size],
        inCart
          ? "bg-[#25D366] text-white hover:bg-[#1da853]"
          : "bg-[#009688] text-white hover:bg-[#00796B]",
        className
      )}
    >
      {inCart ? (
        <>
          <Check className="h-3.5 w-3.5 shrink-0" />
          {qty > 1 ? `×${qty}` : label}
        </>
      ) : (
        <>
          <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
          {label}
        </>
      )}
    </button>
  );
}
