"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Pencil, Plus, BarChart3, Printer, Store } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { ShareButton } from "@/components/ui/share-button";

interface OwnerBarProps {
  sellerId: string;
  sellerName: string;
  completenessPct: number;
  missing: { label: string; href: string }[];
}

export function StoreOwnerBar({ sellerId, sellerName, completenessPct, missing }: OwnerBarProps) {
  const { user } = useAuth();
  const [previewing, setPreviewing] = useState(false);

  // Rien si pas connecté ou pas le propriétaire
  if (!user || user.id !== sellerId) return null;

  // Mode "prévisualiser comme client" : barre réduite à un simple bouton de sortie
  if (previewing) {
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5">
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
    <div className="mb-4 rounded-3xl border border-[#009688]/20 bg-gradient-to-br from-[#E0F2F1] to-white p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#009688] text-white">
            <Store className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-black text-slate-900">Votre boutique publique</p>
            <p className="text-xs text-slate-500">Voici ce que voient actuellement vos clients.</p>
          </div>
        </div>

        {/* Complétude */}
        {completenessPct < 100 && (
          <div className="min-w-[180px]">
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
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#009688]/10 pt-3">
        <button
          type="button"
          onClick={() => setPreviewing(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <Eye className="h-3.5 w-3.5" />
          Prévisualiser
        </button>
        <Link
          href="/seller"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#009688] px-3.5 py-2 text-xs font-black text-white transition hover:bg-[#00796B]"
        >
          <Pencil className="h-3.5 w-3.5" />
          Modifier la boutique
        </Link>
        <Link
          href="/sell"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter un produit
        </Link>
        <Link
          href="/seller/sales"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Statistiques
        </Link>
        <ShareButton
          variant="button"
          label="Partager"
          title={sellerName}
          text={`Découvrez la boutique ${sellerName} sur Rivendy !`}
          className="!rounded-full !py-2 !text-xs"
        />
        <a
          href="#produits"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <Printer className="h-3.5 w-3.5" />
          Imprimer le catalogue
        </a>
      </div>
    </div>
  );
}
