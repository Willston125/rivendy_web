"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, ChevronDown, Pencil, Plus, LayoutGrid, BarChart3, Printer, Share2 } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";

interface OwnerBarProps {
  sellerId: string;
  sellerName: string;
  completenessPct: number;
  missing: { label: string; href: string }[];
}

/** Barre propriétaire compacte, alignée au fil d'Ariane — pas un dashboard. */
export function StoreOwnerBar({ sellerId, sellerName, completenessPct, missing }: OwnerBarProps) {
  const { user } = useAuth();
  const [previewing, setPreviewing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user || user.id !== sellerId) return null;

  const handleShare = async () => {
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: sellerName, text: `Découvrez la boutique ${sellerName} sur Rivendy !`, url: shareUrl });
        return;
      } catch {
        // annulé ou échec — on tente la copie
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // silencieux — pas d'alert() bloquant
    }
  };

  if (previewing) {
    return (
      <div className="mb-2 flex items-center justify-between gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
        <span className="text-xs font-bold text-slate-500">Aperçu client — voici ce que voient vos visiteurs</span>
        <button
          type="button"
          onClick={() => setPreviewing(false)}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-black text-white transition hover:bg-slate-700"
        >
          <EyeOff className="h-3.5 w-3.5" />
          Quitter l&apos;aperçu
        </button>
      </div>
    );
  }

  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs font-semibold text-slate-400">Voici votre boutique telle que vos visiteurs la voient.</p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPreviewing(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <Eye className="h-3.5 w-3.5" />
          Aperçu client
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-slate-900 px-3.5 text-xs font-black text-white transition hover:bg-slate-700"
          >
            Gérer ma boutique
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-100 bg-white py-1.5 shadow-xl shadow-slate-200/50">
                {completenessPct < 100 && (
                  <div className="border-b border-slate-100 px-4 py-3">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                      <span>Boutique complétée</span>
                      <span className="text-[#009688]">{completenessPct}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-[#009688]" style={{ width: `${completenessPct}%` }} />
                    </div>
                    {missing[0] && (
                      <Link
                        href={missing[0].href || "/seller"}
                        className="mt-1 inline-block text-[11px] font-bold text-[#009688] hover:underline"
                      >
                        → {missing[0].label}
                      </Link>
                    )}
                  </div>
                )}

                <Link
                  href="/seller"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Pencil className="h-4 w-4 text-slate-400" />
                  Modifier le profil
                </Link>
                <Link
                  href="/sell"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4 text-slate-400" />
                  Ajouter un produit
                </Link>
                <a
                  href="#produits"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <LayoutGrid className="h-4 w-4 text-slate-400" />
                  Organiser le catalogue
                </a>
                <Link
                  href="/seller/sales"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <BarChart3 className="h-4 w-4 text-slate-400" />
                  Voir les statistiques
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    handleShare();
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Share2 className="h-4 w-4 text-slate-400" />
                  Partager la boutique
                </button>
                <a
                  href="#produits"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Printer className="h-4 w-4 text-slate-400" />
                  Imprimer le catalogue
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
