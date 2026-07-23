"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { X, Smartphone, Download } from "lucide-react";
import { HAS_APP_LINKS, storeUrlForUA } from "@/lib/config/app-links";

/**
 * Bannière "Télécharger l'app Rivendy".
 * - Mobile : smart-banner fixe en bas (incite fortement à passer sur l'app).
 * - Desktop : carte flottante discrète en bas à droite.
 * Fermable, mémorisé dans localStorage (réapparaît après 7 jours).
 */

const LS_KEY = "rivendy_app_banner_dismissed_at";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

export function AppDownloadBanner() {
  const [platform, setPlatform] = useState<"mobile" | "desktop" | null>(null);
  const [storeUrl, setStoreUrl] = useState("/");

  useEffect(() => {
    // L'app n'est pas encore publiée : on n'affiche pas la bannière tant
    // qu'aucun lien store n'est configuré (s'activera automatiquement après).
    if (!HAS_APP_LINKS) return;

    // Respecter une fermeture récente
    const dismissedAt = Number(localStorage.getItem(LS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < SNOOZE_MS) return;

    const ua = navigator.userAgent || "";
    setStoreUrl(storeUrlForUA(ua));

    const isMobile =
      /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.innerWidth < 768;
    setPlatform(isMobile ? "mobile" : "desktop");
  }, []);

  function dismiss() {
    localStorage.setItem(LS_KEY, String(Date.now()));
    setPlatform(null);
  }

  if (!platform) return null;

  const AppIcon = (
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#009688]">
      <Image src="/brand/rivendy-logo-mark.png" alt="Rivendy" fill sizes="44px" className="object-cover" />
    </span>
  );

  // ── Mobile : smart-banner fixe en bas ──────────────────────────
  if (platform === "mobile") {
    return (
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] md:hidden">
        <div className="flex items-center gap-3">
          {AppIcon}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-slate-900">Application Rivendy</p>
            <p className="truncate text-xs text-slate-500">
              Meilleure expérience, notifications, plus rapide.
            </p>
          </div>
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-full bg-[#009688] px-4 py-2 text-sm font-black text-white transition hover:bg-[#00796B]"
          >
            Installer
          </a>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fermer"
            className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── Desktop : carte flottante en bas à droite ──────────────────
  return (
    <div className="fixed bottom-6 right-6 z-50 hidden w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl md:block">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer"
        className="absolute right-2 top-2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="p-5">
        <div className="flex items-center gap-3">
          {AppIcon}
          <div>
            <p className="text-sm font-black text-slate-900">Téléchargez l&apos;app Rivendy</p>
            <p className="text-xs text-slate-500">Pour une expérience optimale</p>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Smartphone className="h-4 w-4 shrink-0 text-[#009688]" />
          Notifications en temps réel, navigation plus fluide, stories et plus.
        </p>
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#009688] text-sm font-black text-white transition hover:bg-[#00796B]"
        >
          <Download className="h-4 w-4" />
          Télécharger l&apos;application
        </a>
      </div>
    </div>
  );
}
