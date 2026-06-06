"use client";

import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  Percent,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store,
  Trash2,
} from "lucide-react";
import { useCart } from "@/features/cart/cart-provider";
import { useCountryOrDefault } from "@/features/country/country-provider";
import { firstPhoto, formatMoney } from "@/lib/utils/format";

/* ── Statistiques Rivendy (statiques pour l'instant) ─────────── */
const STATS = [
  { value: "5 842",   label: "Produits en ligne" },
  { value: "1 296",   label: "Boutiques actives" },
  { value: "24 350+", label: "Clients satisfaits" },
];

export function RightSidebar() {
  const { items, totalAmount, removeItem } = useCart();
  const country = useCountryOrDefault();

  const previewItems = items.slice(0, 3);

  return (
    <aside className="sticky top-[72px] hidden h-[calc(100vh-72px)] flex-col gap-3 overflow-y-auto pb-8 lg:flex w-[300px] no-scrollbar">

      {/* ══════════════════════════════════════════════════════════
          MON PANIER
      ══════════════════════════════════════════════════════════ */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {/* En-tête panier */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-[#009688]" />
            <h3 className="text-sm font-black text-slate-900">Mon Panier</h3>
          </div>
          {items.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#009688] px-1.5 text-[10px] font-black text-white">
              {items.length}
            </span>
          )}
        </div>

        {/* Items du panier */}
        {previewItems.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {previewItems.map(({ product, quantity }) => (
              <div key={product.id} className="flex items-center gap-3 px-4 py-3">
                {/* Image produit */}
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  <Image
                    src={firstPhoto(product)}
                    alt={product.title}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </div>
                {/* Infos */}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-[12px] font-semibold text-slate-900">
                    {product.title}
                  </p>
                  {product.size && (
                    <p className="text-[11px] text-slate-400">
                      {product.size && `Taille ${product.size} · `}
                      {quantity > 1 ? `${quantity}x ` : ""}
                      {formatMoney(product.price, country)}
                    </p>
                  )}
                  {!product.size && (
                    <p className="text-[11px] text-slate-400">
                      {quantity > 1 ? `${quantity}x ` : ""}
                      {formatMoney(product.price, country)}
                    </p>
                  )}
                </div>
                {/* Supprimer */}
                <button
                  type="button"
                  onClick={() => removeItem(product.id)}
                  aria-label="Retirer du panier"
                  className="shrink-0 text-slate-300 transition hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* Sous-total */}
            <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold text-slate-500">Sous-total</p>
              <p className="text-sm font-black text-slate-900">
                {formatMoney(totalAmount, country)}
              </p>
            </div>
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <ShoppingCart className="mx-auto h-8 w-8 text-slate-200" />
            <p className="mt-2 text-xs text-slate-400">Votre panier est vide</p>
          </div>
        )}

        {/* CTA */}
        <div className="px-4 pb-4 pt-2">
          {items.length > 0 ? (
            <Link
              href="/cart"
              className="flex h-10 w-full items-center justify-center rounded-xl bg-[#009688] text-sm font-bold text-white transition hover:bg-[#00796B]"
            >
              Voir le panier
            </Link>
          ) : (
            <Link
              href="/"
              className="flex h-10 w-full items-center justify-center rounded-xl border border-[#009688]/30 bg-[#E0F2F1] text-sm font-bold text-[#009688] transition hover:bg-[#B2DFDB]"
            >
              Explorer les produits
            </Link>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          PROTECTION ACHETEUR
      ══════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm">
        <h3 className="mb-3 text-sm font-black text-slate-900">Protection acheteur</h3>
        <ul className="space-y-2.5">
          <li className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#009688]" />
            <p className="text-[12px] font-medium text-slate-600">Paiement 100% sécurisé</p>
          </li>
          <li className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#009688]" />
            <p className="text-[12px] font-medium text-slate-600">Produits conformes ou remboursés</p>
          </li>
          <li className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#009688]" />
            <p className="text-[12px] font-medium text-slate-600">Support client dédié</p>
          </li>
          <li className="flex items-center gap-2.5">
            <Star className="h-4 w-4 shrink-0 text-[#009688]" />
            <p className="text-[12px] font-medium text-slate-600">Vendeurs vérifiés</p>
          </li>
        </ul>
        <Link
          href="/help"
          className="mt-3 inline-block text-[12px] font-bold text-[#009688] transition hover:underline"
        >
          En savoir plus
        </Link>
      </div>


      {/* ══════════════════════════════════════════════════════════
          VENDRE SUR RIVENDY
      ══════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="pointer-events-none absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-[#E0F2F1]" />
        <div className="relative flex items-start gap-3">
          <div className="flex-1">
            <h3 className="text-sm font-black text-slate-900">Vendre sur Rivendy</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Développez votre boutique et touchez des milliers d&apos;acheteurs à {country.name} et partout.
            </p>
            <Link
              href="/seller/create"
              className="mt-3 inline-flex h-9 items-center rounded-xl bg-[#009688] px-4 text-[12px] font-bold text-white transition hover:bg-[#00796B]"
            >
              Ouvrir ma boutique
            </Link>
          </div>
          {/* Icône boutique */}
          <div className="shrink-0">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E0F2F1]">
              <Store className="h-8 w-8 text-[#009688]" />
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          STATISTIQUES RIVENDY
      ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-3 gap-2">
        {STATS.map(({ value, label }) => (
          <div key={label} className="flex flex-col items-center rounded-2xl bg-white py-3 shadow-sm border border-slate-100">
            <p className="text-base font-black text-[#009688]">{value}</p>
            <p className="mt-0.5 text-center text-[9px] font-semibold leading-tight text-slate-400">
              {label}
            </p>
          </div>
        ))}
      </div>

    </aside>
  );
}
