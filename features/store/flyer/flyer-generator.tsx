"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, Share2, X } from "lucide-react";
import type { Country, Product } from "@/types/rivendy";
import { formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import {
  FLYER_THEMES,
  FLYER_THEME_IDS,
  FLYER_TYPES,
  resolveFlyerTheme,
  selectFlyerProducts,
  type FlyerThemeId,
  type FlyerType,
} from "@/features/store/flyer/flyer-model";
import { drawFlyer, loadFlyerImage, productPhoto } from "@/features/store/flyer/flyer-draw";

/** Événement d'ouverture, émis par le menu « Gérer ma boutique ». */
export const OPEN_FLYER_EVENT = "rivendy:open-flyer";

/**
 * Générateur de flyer WhatsApp (statut 9:16) — parité avec
 * FlyerGeneratorSheet de l'app : 3 compositions, univers résolu
 * automatiquement (modifiable), aperçu, partage du PNG avec le lien de la
 * boutique (ou téléchargement si le navigateur ne partage pas de fichier).
 * Réservé au propriétaire : seul StoreOwnerBar émet l'événement.
 */
export function FlyerGenerator({
  sellerId,
  sellerName,
  avatarUrl,
  isCertified,
  rating,
  reviews,
  products,
  country,
  storeUrl,
}: {
  sellerId: string;
  sellerName: string;
  avatarUrl: string;
  isCertified: boolean;
  rating: number;
  reviews: number;
  products: Product[];
  country: Country | null;
  storeUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FlyerType>("arrival");
  const autoTheme = useMemo(() => resolveFlyerTheme(products), [products]);
  const [themeId, setThemeId] = useState<FlyerThemeId>(autoTheme);
  const [rendering, setRendering] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCache = useRef(new Map<string, HTMLImageElement | null>());

  useEffect(() => {
    const onOpen = () => {
      setMessage(null);
      setOpen(true);
    };
    window.addEventListener(OPEN_FLYER_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_FLYER_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Rendu : charge les images manquantes puis dessine.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const selection = selectFlyerProducts(products, type);
    const urls = [avatarUrl, productPhoto(selection.hero), ...selection.secondary.map(productPhoto)].filter(Boolean);
    const cache = imageCache.current;
    (async () => {
      const missing = urls.filter((u) => !cache.has(u));
      if (missing.length > 0) {
        setRendering(true);
        const loaded = await Promise.all(missing.map(loadFlyerImage));
        missing.forEach((u, i) => cache.set(u, loaded[i]));
      }
      if (cancelled || !canvasRef.current) return;
      const images = new Map<string, HTMLImageElement>();
      for (const u of urls) {
        const img = cache.get(u);
        if (img) images.set(u, img);
      }
      drawFlyer(canvasRef.current, {
        type,
        themeId,
        sellerName,
        isCertified,
        rating,
        reviews,
        storeUrl,
        selection,
        formatPrice: (v) => formatMoney(v, country),
        images,
        avatarUrl,
      });
      setRendering(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, type, themeId, products, avatarUrl, sellerName, isCertified, rating, reviews, storeUrl, country]);

  const exportFlyer = async () => {
    const canvas = canvasRef.current;
    if (!canvas || exporting) return;
    setExporting(true);
    setMessage(null);
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("export");
      const fileName = `flyer-${sellerId.slice(0, 8)}-${type}.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      const label = FLYER_TYPES.find((f) => f.id === type)?.label ?? "Flyer";
      const text =
        `✨ ${label} chez ${sellerName} sur Rivendy !\n` +
        `Découvrez toutes nos offres directement sur notre boutique :\n${storeUrl}`;
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text });
          return;
        } catch (err) {
          if ((err as DOMException)?.name === "AbortError") return;
          // Partage refusé : on retombe sur le téléchargement.
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Flyer téléchargé. Publiez-le en statut WhatsApp avec le lien de votre boutique.");
    } catch {
      setMessage("Impossible de générer le flyer. Réessayez.");
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="flyer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="flex max-h-[96vh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="flyer-title" className="text-lg font-black text-slate-900">Créer mon flyer WhatsApp</h2>
            <p className="text-[12px] text-slate-500">Format statut 9:16 · 1080 × 1920</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fermer"
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {/* Compositions */}
          <div className="grid grid-cols-3 gap-2">
            {FLYER_TYPES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setType(f.id)}
                aria-pressed={type === f.id}
                className={cn(
                  "rounded-2xl border px-2 py-2.5 text-center transition",
                  type === f.id
                    ? "border-[#009688] bg-[#E0F2F1] text-[#007168]"
                    : "border-slate-200 bg-white text-slate-600 hover:border-[#009688]/40",
                )}
              >
                <span className="block text-[13px] font-black">{f.label}</span>
                <span className="block text-[11px] font-medium opacity-80">{f.subtitle}</span>
              </button>
            ))}
          </div>

          {/* Univers */}
          <label className="mt-3 block text-[12px] font-bold text-slate-500">
            Univers visuel
            <select
              value={themeId}
              onChange={(e) => setThemeId(e.target.value as FlyerThemeId)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-800 focus:border-[#009688] focus:outline-none"
            >
              {FLYER_THEME_IDS.map((id) => (
                <option key={id} value={id}>
                  {FLYER_THEMES[id].label}
                  {id === autoTheme ? " (suggéré)" : ""}
                </option>
              ))}
            </select>
          </label>

          {/* Aperçu */}
          <div className="relative mx-auto mt-4 w-full max-w-[300px] overflow-hidden rounded-2xl shadow-lg">
            <canvas ref={canvasRef} className="block h-auto w-full" style={{ aspectRatio: "9 / 16" }} />
            {rendering && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/40">
                <Loader2 className="h-6 w-6 animate-spin text-[#009688]" />
              </div>
            )}
          </div>

          {products.length === 0 && (
            <p className="mt-3 text-center text-[12.5px] font-semibold text-amber-700">
              Publiez au moins un article actif pour illustrer votre flyer.
            </p>
          )}
          {message && <p className="mt-3 text-center text-[12.5px] font-semibold text-slate-600">{message}</p>}
        </div>

        <div className="border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={exportFlyer}
            disabled={exporting || rendering}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#009688] py-3 text-[14px] font-black text-white transition hover:bg-[#007168] disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : typeof navigator !== "undefined" && typeof navigator.canShare === "function" ? (
              <Share2 className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Partager / télécharger le flyer
          </button>
        </div>
      </div>
    </div>
  );
}
