"use client";

import { useState } from "react";
import { Info, MapPin, CalendarDays, Tag, ShieldCheck, Check, Link2 } from "lucide-react";
import type { Country, Product, Profile } from "@/types/rivendy";
import { categoryLabel } from "@/lib/utils/format";
import { distinctCategories } from "@/features/store/store-helpers";
import { FacebookIcon, WhatsAppIcon } from "@/components/ui/social-icons";

/**
 * Colonne latérale « À propos » de la boutique : description, infos clés,
 * et partage du lien public. Le partage WhatsApp/Facebook ne fait que
 * relayer l'URL de la boutique — jamais de mise en relation directe avec
 * le vendeur (règle métier Rivendy : tout contact passe par la plateforme).
 */
export function StoreAbout({
  seller,
  country,
  products,
  memberSince,
  shareUrl,
}: {
  seller: Profile;
  country: Country;
  products: Product[];
  memberSince: string | null;
  /** URL canonique calculée côté serveur (évite un hydration mismatch avec window.location) */
  shareUrl: string;
}) {
  const cats = distinctCategories(products);
  const sellerName = seller.store_name || seller.full_name || "Cette boutique";
  const [copied, setCopied] = useState(false);

  const shareText = `Découvrez la boutique ${sellerName} sur Rivendy !`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silencieux
    }
  };

  return (
    <aside id="a-propos" className="scroll-mt-24 space-y-4">
      {/* À propos */}
      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#E0F2F1] text-[#009688]">
            <Info className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-black text-slate-900">À propos de la boutique</h3>
        </div>

        {seller.store_description ? (
          <p className="text-sm leading-relaxed text-slate-600">{seller.store_description}</p>
        ) : (
          <p className="text-sm text-slate-400">{sellerName} n&apos;a pas encore ajouté de description.</p>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 p-3.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#009688]" />
          <p className="text-xs leading-relaxed text-slate-500">
            Toutes les commandes et paiements passent par Rivendy : le service client est centralisé,
            vous ne payez jamais le vendeur directement.
          </p>
        </div>
      </div>

      {/* Informations */}
      <div className="space-y-2.5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-black text-slate-900">Informations</h3>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
          {country.name}
        </div>
        {memberSince && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
            Ouverte depuis {memberSince}
          </div>
        )}
        {cats.length > 0 && (
          <div className="flex items-start gap-2 text-sm text-slate-600">
            <Tag className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div className="flex flex-wrap gap-1.5">
              {cats.slice(0, 6).map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600"
                >
                  {categoryLabel(c)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Partager — relaie uniquement le lien public, jamais un contact direct */}
      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black text-slate-900">Partagez cette boutique</h3>
        <p className="mt-0.5 text-xs text-slate-400">Faites découvrir {sellerName} à vos amis</p>
        <div className="mt-3 flex items-center gap-2">
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Partager sur Facebook"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-[#1877F2] transition hover:bg-slate-200"
          >
            <FacebookIcon className="h-[18px] w-[18px]" />
          </a>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Partager sur WhatsApp"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-[#25D366] transition hover:bg-slate-200"
          >
            <WhatsAppIcon className="h-[18px] w-[18px]" />
          </a>
          <button
            type="button"
            onClick={copyLink}
            aria-label="Copier le lien"
            className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
              copied ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {copied ? <Check className="h-[18px] w-[18px]" /> : <Link2 className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
