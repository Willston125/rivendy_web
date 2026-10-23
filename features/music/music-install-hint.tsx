"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Share, X } from "lucide-react";
import { PLAY_STORE_URL } from "@/features/play/play-link-page";
import { installHint, type InstallHint } from "./music-logic";
import { iconButton } from "./music-ui";

/**
 * Téléphone (lot « Musique web », 2026-10-23) : garder Rivendy Musique sous
 * la main. iPhone : « Sur l'écran d'accueil » (aucune appli iOS, le site est
 * la porte) ; Android : l'appli Rivendy, le même compte. « Plus tard » :
 * 30 jours de silence, retenus dans ce navigateur seulement.
 */
const KEY = "rivendy_music_install_hint";

export function MusicInstallHint() {
  const [hint, setHint] = useState<InstallHint>(null);

  useEffect(() => {
    let dismissedAt: number | null = null;
    try {
      const v = Number(localStorage.getItem(KEY));
      dismissedAt = Number.isFinite(v) && v > 0 ? v : null;
    } catch { /* stockage indisponible : on propose quand même */ }
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setHint(installHint({ ua: navigator.userAgent, standalone, touchPoints: navigator.maxTouchPoints ?? 0, dismissedAt, now: Date.now() }));
  }, []);

  if (!hint) return null;

  function later() {
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* stockage indisponible */ }
    setHint(null);
  }

  return (
    <aside aria-label="Garder Rivendy Musique sous la main"
      className="mb-3 flex items-start gap-3 rounded-lg border border-rvm-line bg-rvm-raised p-3.5">
      <Image src="/brand/rivendy-logo-mark-192.png" alt="" width={44} height={44} unoptimized className="h-11 w-11 shrink-0 rounded-xl" />
      {hint === "ios" ? (
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-bold">Ajoutez Rivendy Musique à votre écran d’accueil</p>
          <p className="mt-0.5 leading-relaxed text-rvm-soft">
            Dans Safari, touchez <Share className="inline h-4 w-4 align-[-3px] text-rvm-text" aria-label="Partager" /> puis
            « Sur l’écran d’accueil ». Elle s’ouvrira comme une application.
          </p>
        </div>
      ) : (
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-bold">Écoutez dans l’application Rivendy</p>
          <p className="mt-0.5 leading-relaxed text-rvm-soft">La Musique, Play et la marketplace, avec le même compte.</p>
          <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer"
            className="mt-2.5 inline-flex h-9 items-center whitespace-nowrap rounded-full bg-rvm-accent px-4 text-sm font-bold text-rvm-on-accent hover:bg-rvm-accent-hover active:bg-rvm-accent-pressed">
            Installer l’application
          </a>
        </div>
      )}
      <button type="button" onClick={later} aria-label="Plus tard" title="Plus tard" className={iconButton}>
        <X className="h-4 w-4" aria-hidden />
      </button>
    </aside>
  );
}
