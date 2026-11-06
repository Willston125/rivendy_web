"use client";

import { variantOptions } from "@/features/cart/cart-logic";
import type { Product } from "@/types/rivendy";

/** Choix de la taille et de la couleur d'un article, au panier et à la commande. */
export function VariantSelects({
  product,
  size,
  color,
  onChange,
}: {
  product: Product;
  size?: string;
  color?: string;
  onChange: (variant: { size?: string; color?: string }) => void;
}) {
  const { sizes, colors } = variantOptions(product);
  if (sizes.length === 0 && colors.length === 0) return null;
  const selectClass =
    "rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 focus:border-[#009688] focus:outline-none";
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {sizes.length > 0 && (
        <select
          aria-label={`Taille de ${product.title}`}
          value={size ?? ""}
          onChange={(e) => onChange({ size: e.target.value })}
          className={selectClass}
        >
          <option value="">Taille…</option>
          {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
      {colors.length > 0 && (
        <select
          aria-label={`Couleur de ${product.title}`}
          value={color ?? ""}
          onChange={(e) => onChange({ color: e.target.value })}
          className={selectClass}
        >
          <option value="">Couleur…</option>
          {colors.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
    </div>
  );
}
