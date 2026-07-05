"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  Baby,
  Eye,
  EyeOff,
  Globe,
  Mail,
  MessageSquare,
  Package,
  ShoppingBag,
  ShoppingCart,
  Shirt,
  Smartphone,
  Sparkles,
  Store,
  Utensils,
  Pill,
  BedDouble,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountryOrDefault } from "@/features/country/country-provider";
import { formatMoney } from "@/lib/utils/format";
import { FacebookIcon, InstagramIcon } from "@/components/ui/social-icons";
import { StoriesRail } from "@/features/products/stories-rail";
import type { Product } from "@/types/rivendy";
import type { CategoryId } from "@/types/rivendy";

/* ── Catégories rapides ──────────────────────────────────────────── */
const QUICK_CATEGORIES: { id: CategoryId | string; label: string; icon: LucideIcon }[] = [
  { id: "restaurant",    label: "Restaurant",     icon: Utensils },
  { id: "alimentation",  label: "Supermarché",    icon: ShoppingCart },
  { id: "pharmacie",     label: "Pharmacie",      icon: Pill },
  { id: "femme",         label: "Femme",          icon: ShoppingBag },
  { id: "homme",         label: "Homme",           icon: Shirt },
  { id: "bebeEnfants",   label: "Bébé & Enfants",  icon: Baby },
  { id: "electronique",  label: "Électronique",    icon: Smartphone },
  { id: "maison",        label: "Maison",          icon: Package },
  { id: "beauteParfums", label: "Beauté & Parfum", icon: Sparkles },
  { id: "hotel",         label: "Hôtels",          icon: BedDouble },
];

export function LeftSidebar({
  stories,
  countryId,
}: {
  stories: Product[];
  countryId: string;
}) {
  const { profile, user } = useAuth();
  const countryNullable = useCountryOrDefault();
  const country = countryNullable as any;
  const [balanceVisible, setBalanceVisible] = useState(true);

  const displayName = profile?.full_name || profile?.store_name || user?.email?.split("@")[0] || "Invité";
  const isCertified = profile?.is_certified ?? false;

  if (!country) return null;

  return (
    <aside className="hidden space-y-4 xl:block">

      {/* ══════════════════════════════════════════════════════════════
          CARTE PROFIL UTILISATEUR
      ══════════════════════════════════════════════════════════════ */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="p-5">
          {user ? (
            <>
              {/* Profil connecté */}
              <div className="flex items-center gap-3">
                <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[#009688] text-lg font-bold text-white ring-2 ring-[#009688]/15">
                  {profile?.avatar_url ? (
                    <Image src={profile.avatar_url} alt="" fill sizes="48px" className="object-cover" />
                  ) : (
                    displayName.charAt(0).toUpperCase()
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{displayName}</p>
                  <p className="text-xs text-slate-400">Bienvenue sur Rivendy 👋</p>
                </div>
              </div>

              {/* Badge vendeur vérifié */}
              {isCertified && (
                <div className="mt-3 flex items-center gap-1.5">
                  <BadgeCheck className="h-4 w-4 text-[#009688]" />
                  <span className="text-xs font-semibold text-[#009688]">Vendeur vérifié</span>
                </div>
              )}

              {/* Solde portefeuille */}
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium text-slate-400">Solde portefeuille</p>
                  <button
                    type="button"
                    onClick={() => setBalanceVisible((v) => !v)}
                    className="text-slate-400 transition hover:text-slate-600"
                    aria-label="Toggle balance visibility"
                  >
                    {balanceVisible
                      ? <Eye className="h-3.5 w-3.5" />
                      : <EyeOff className="h-3.5 w-3.5" />
                    }
                  </button>
                </div>
                <p className="mt-0.5 text-lg font-extrabold text-slate-900">
                  {balanceVisible ? formatMoney(12450, country) : "••••••"}
                </p>
              </div>

              {/* Bouton Mon espace vendeur */}
              <Link
                href="/seller"
                className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-semibold text-slate-700 transition hover:border-[#009688]/30 hover:bg-[#E0F2F1] hover:text-[#009688]"
              >
                <Store className="h-4 w-4" />
                Mon espace vendeur
              </Link>
            </>
          ) : (
            <>
              {/* Invité */}
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400">
                  <Store className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">Bienvenue 👋</p>
                  <p className="text-xs text-slate-400">Connectez-vous pour acheter et vendre</p>
                </div>
              </div>
              <Link
                href="/auth/login"
                className="mt-4 flex h-10 w-full items-center justify-center rounded-xl bg-[#009688] text-sm font-bold text-white transition hover:bg-[#00796B]"
              >
                Se connecter
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          HISTOIRES DE BOUTIQUES
      ══════════════════════════════════════════════════════════════ */}
      {stories.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between px-1">
            <h3 className="text-[13px] font-bold text-slate-900">Histoires de boutiques</h3>
          </div>
          <StoriesRail
            products={stories}
            excludeSellerId={user?.id}
            limit={8}
            variant="sidebar"
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          CATÉGORIES RAPIDES
      ══════════════════════════════════════════════════════════════ */}
      <div>
        <h3 className="mb-2 px-1 text-[13px] font-bold text-slate-900">Catégories rapides</h3>
        <div className="space-y-0.5">
          {QUICK_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.id}
                href={`/?country=${countryId}&category=${cat.id}`}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-600 transition hover:bg-[#E0F2F1] hover:text-[#009688]"
              >
                <Icon className="h-4 w-4 shrink-0 text-[#009688]" />
                {cat.label}
              </Link>
            );
          })}
        </div>
        <Link
          href={`/?country=${countryId}`}
          className="mt-2 flex h-9 w-full items-center justify-center rounded-xl bg-[#E0F2F1] text-xs font-bold text-[#009688] transition hover:bg-[#B2DFDB]"
        >
          Toutes les catégories
        </Link>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MINI-FOOTER
      ══════════════════════════════════════════════════════════════ */}
      <div className="border-t border-slate-100 px-1 pt-4">
        <p className="text-xs font-bold text-slate-900">Rivendy</p>
        <p className="mt-1 text-[10px] text-slate-400">© 2024 Rivendy. Tous droits réservés.</p>
        <div className="mt-2.5 flex items-center gap-2.5">
          <a href="https://facebook.com/rivendy" target="_blank" rel="noreferrer" className="text-slate-300 transition hover:text-[#1877F2]" aria-label="Facebook">
            <FacebookIcon className="h-3.5 w-3.5" />
          </a>
          <a href="https://instagram.com/rivendy" target="_blank" rel="noreferrer" className="text-slate-300 transition hover:text-[#E4405F]" aria-label="Instagram">
            <InstagramIcon className="h-3.5 w-3.5" />
          </a>
          <a href="https://tiktok.com/@rivendy" target="_blank" rel="noreferrer" className="text-slate-300 transition hover:text-slate-900" aria-label="TikTok">
            <span className="font-bold text-[10px]">TK</span>
          </a>
          <a href="mailto:contact@rivendy.com" className="text-slate-300 transition hover:text-[#009688]" aria-label="Email">
            <Mail className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </aside>
  );
}
