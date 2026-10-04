"use client";

import { AlertTriangle, X } from "lucide-react";
import { useCart } from "@/features/cart/cart-provider";

/** Avis de la dernière revérification du panier : articles retirés ou quantités ajustées. */
export function CartNotice() {
  const { cartNotice, dismissCartNotice } = useCart();
  if (!cartNotice) return null;
  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1">{cartNotice}</p>
      <button
        type="button"
        onClick={dismissCartNotice}
        aria-label="Fermer l'avis"
        className="-m-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-amber-700 transition hover:bg-amber-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
