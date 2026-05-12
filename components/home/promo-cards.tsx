import Image from "next/image";
import Link from "next/link";
import { Package, Percent } from "lucide-react";

/**
 * 3 cartes promotionnelles — fidèles à l'image de référence
 */
export function PromoCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">

      {/* ── Carte 2 : Offres exclusives ──────────────────────────── */}
      <Link
        href="/seller/promo"
        className="group relative flex h-[120px] overflow-hidden rounded-2xl border border-orange-100 bg-orange-50 shadow-sm transition hover:shadow-md"
      >
        <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-orange-100/70" />

        <div className="relative z-10 flex flex-1 flex-col justify-center gap-1 p-4">
          <div className="flex items-center gap-1.5">
            <Percent className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-[11px] font-black uppercase tracking-wider text-orange-500">
              Offres exclusives
            </span>
          </div>
          <p className="text-[12px] leading-snug text-slate-700">
            Des réductions spéciales seulement pour vous.
          </p>
          <span className="mt-1.5 text-[12px] font-bold text-orange-500">
            Découvrir →
          </span>
        </div>

        {/* Image droite */}
        <div className="relative w-[88px] shrink-0">
          <Image
            src="/brand/promo-discount.png"
            alt="Offres exclusives"
            fill
            className="object-cover object-left"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-orange-50 via-orange-50/60 to-transparent" />
        </div>
      </Link>

      {/* ── Carte 3 : Sur commande ────────────────────────────────── */}
      <Link
        href="/preorders"
        className="group relative flex h-[120px] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md sm:col-span-1"
      >
        <div className="pointer-events-none absolute -bottom-5 -right-5 h-20 w-20 rounded-full bg-[#E0F2F1]/80" />

        <div className="relative z-10 flex flex-1 flex-col justify-center gap-1 p-4">
          <div className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-[#009688]" />
            <span className="text-[11px] font-black uppercase tracking-wider text-[#009688]">
              Sur commande
            </span>
          </div>
          <p className="text-[12px] leading-snug text-slate-700">
            Commandez des produits introuvables localement.
          </p>
          <span className="mt-1.5 text-[12px] font-bold text-[#009688]">
            Commander →
          </span>
        </div>

        {/* Image droite */}
        <div className="relative w-[88px] shrink-0">
          <Image
            src="/brand/promo-preorder.png"
            alt="Sur commande"
            fill
            className="object-cover object-left"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/60 to-transparent" />
        </div>
      </Link>
    </div>
  );
}
