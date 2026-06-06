"use client";

import Image from "next/image";
import Link from "next/link";
import { MessageCircle, Minus, Plus, ShoppingBag, Store, Trash2, MessageSquare } from "lucide-react";
import { useCart } from "@/features/cart/cart-provider";
import { useCountryOrDefault } from "@/features/country/country-provider";
import { firstPhoto, formatMoney } from "@/lib/utils/format";

export function CartView() {
  const {
    groups,
    totalAmount,
    totalItems,
    sellerCount,
    increment,
    decrement,
    removeItem,
    clearCart,
  } = useCart();
  const country = useCountryOrDefault();

  // ── Panier vide ────────────────────────────────────────────────────────────
  if (!totalItems) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#F5F7FA]">
          <ShoppingBag className="h-9 w-9 text-slate-300" />
        </div>
        <h1 className="mt-5 text-2xl font-black text-[#1A1A1A]">Panier vide</h1>
        <p className="mt-2 text-sm text-slate-500">
          Ajoute des produits depuis le feed pour commander via Rivendy.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-12 items-center rounded-full bg-[#009688] px-8 text-sm font-black text-white transition hover:bg-[#00796B]"
        >
          Explorer le feed
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 md:pb-10 md:px-6 md:py-10">

        {/* En-tête */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black text-[#1A1A1A] md:text-4xl">Mon panier</h1>
            <p className="mt-1 text-sm text-slate-500">
              {sellerCount} boutique{sellerCount > 1 ? "s" : ""} · {totalItems} article{totalItems > 1 ? "s" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={clearCart}
            className="text-sm font-bold text-slate-400 transition hover:text-red-500"
          >
            Vider le panier
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">

          {/* ── ITEMS PAR GROUPE VENDEUR ───────────────────────────────── */}
          <div className="space-y-4">
            {groups.map((group) => {
              const groupTotal = group.items.reduce(
                (sum, item) => sum + item.product.price * item.quantity,
                0,
              );
              return (
                <section key={group.sellerId} className="overflow-hidden rounded-2xl bg-white shadow-sm">

                  {/* Header groupe */}
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <Link
                      href={`/store/${group.sellerId}`}
                      className="flex items-center gap-2 text-sm font-black text-[#1A1A1A] hover:text-[#009688]"
                    >
                      <Store className="h-4 w-4 text-[#009688]" />
                      {group.sellerName}
                    </Link>
                    <span className="text-sm font-black text-[#009688]">
                      {formatMoney(groupTotal, country)}
                    </span>
                  </div>

                  {/* Articles du groupe */}
                  <div className="divide-y divide-slate-50 p-3 space-y-0">
                    {group.items.map((item) => {
                      const lineTotal = item.product.price * item.quantity;
                      return (
                        <div key={item.product.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">

                          {/* Image */}
                          <Link
                            href={`/products/${item.product.id}`}
                            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100"
                          >
                            <Image
                              src={firstPhoto(item.product)}
                              alt={item.product.title}
                              fill
                              sizes="80px"
                              className="object-cover transition hover:scale-105"
                            />
                          </Link>

                          {/* Infos */}
                          <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                            <div className="flex items-start justify-between gap-2">
                              <Link
                                href={`/products/${item.product.id}`}
                                className="line-clamp-2 text-sm font-bold text-[#1A1A1A] hover:text-[#009688]"
                              >
                                {item.product.title}
                              </Link>
                              {/* Sous-total ligne — visible partout */}
                              <span className="shrink-0 text-sm font-black text-[#1A1A1A]">
                                {formatMoney(lineTotal, country)}
                              </span>
                            </div>

                            <p className="text-xs text-slate-400">
                              {formatMoney(item.product.price, country)} / unité
                            </p>

                            {/* Contrôles quantité + supprimer */}
                            <div className="mt-2 flex items-center gap-3">
                              {/* Pill quantité */}
                              <div className="flex items-center gap-0 overflow-hidden rounded-full border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => decrement(item.product.id)}
                                  aria-label="Diminuer"
                                  className="flex h-8 w-8 items-center justify-center text-slate-500 transition hover:bg-slate-100 active:bg-slate-200"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-8 text-center text-sm font-black text-[#1A1A1A]">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => increment(item.product.id)}
                                  aria-label="Augmenter"
                                  className="flex h-8 w-8 items-center justify-center text-slate-500 transition hover:bg-slate-100 active:bg-slate-200"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>

                              {/* Supprimer */}
                              <button
                                type="button"
                                onClick={() => removeItem(item.product.id)}
                                aria-label="Supprimer"
                                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition hover:bg-red-50 hover:text-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          {/* ── ASIDE RÉSUMÉ — sticky desktop ─────────────────────────── */}
          <aside className="hidden h-fit space-y-4 lg:sticky lg:top-24 lg:block">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-[#1A1A1A]">Résumé</h2>

              {/* Détail par boutique */}
              <div className="mt-4 space-y-2">
                {groups.map((group) => {
                  const groupTotal = group.items.reduce(
                    (sum, item) => sum + item.product.price * item.quantity,
                    0,
                  );
                  return (
                    <div key={group.sellerId} className="flex justify-between text-sm">
                      <span className="truncate pr-2 text-slate-500">{group.sellerName}</span>
                      <span className="shrink-0 font-bold text-[#1A1A1A]">
                        {formatMoney(groupTotal, country)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Total */}
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-sm font-bold text-slate-500">Total</span>
                <span className="text-xl font-black text-[#1A1A1A]">
                  {formatMoney(totalAmount, country)}
                </span>
              </div>

              {/* Info livraison */}
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#E0F2F1] p-3 text-xs font-semibold text-[#009688]">
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />
                Livraison et paiement confirmés après validation Rivendy.
              </div>

              {/* Bouton commander */}
              <Link
                href="/checkout"
                className="mt-4 flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-[#25D366] text-sm font-black text-white transition hover:bg-[#1da853]"
              >
                <MessageSquare className="h-5 w-5 fill-white" />
                Commander · {formatMoney(totalAmount, country)}
              </Link>
            </div>
          </aside>
        </div>
      </div>

      {/* ── BARRE FIXE MOBILE (au-dessus de la nav) ───────────────────── */}
      <div className="fixed bottom-16 inset-x-0 z-30 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur-sm lg:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-500">
              {totalItems} article{totalItems > 1 ? "s" : ""}
            </p>
            <p className="text-base font-black text-[#1A1A1A]">
              {formatMoney(totalAmount, country)}
            </p>
          </div>
          <Link
            href="/checkout"
            className="flex h-12 items-center gap-2 rounded-full bg-[#25D366] px-6 text-sm font-black text-white transition hover:bg-[#1da853]"
          >
            <MessageSquare className="h-4 w-4 fill-white" />
            Commander
          </Link>
        </div>
      </div>
    </>
  );
}
