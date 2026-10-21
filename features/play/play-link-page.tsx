import Link from "next/link";
import { Download, Smartphone, Clapperboard } from "lucide-react";
import { ProductVideoPlayer } from "@/features/products/product-video-player";

/**
 * Rivendy Play — page de repli d'un lien partagé (lot K de l'audit 16,
 * 2026-10-14) : `/play/short/{rivendy|public}/{id}`, et l'écran « indisponible »
 * de /play. `/play/title/{id}` redirige désormais vers la fiche complète
 * (Omnicanal lot C).
 *
 * Avec l'application Rivendy (1.3.4 et suivantes), Android ouvre le lien
 * DIRECTEMENT dans l'app (App Link, même hôte vérifié que /store). Cette page
 * ne s'affiche donc que sans l'app, ou avec une version plus ancienne.
 *
 * ⚠️ Aucun prix, aucun Pass, aucun lien d'achat ici : le lien vient de l'app
 * Android (règle Google Play) — la page renvoie seulement vers Google Play.
 */

export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.rivendy.app";
const APP_PACKAGE = "com.rivendy.app";

/** Ouvre l'app si elle est installée (Android), sinon la fiche Google Play. */
export function appIntentUrl(path: string): string {
  return `intent://www.rivendy.com${path}#Intent;scheme=https;package=${APP_PACKAGE};S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PlayLinkContent = {
  kicker: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  image?: string | null;
  /** Vidéo PUBLIQUE (Short, clip d'artiste, bande-annonce) : lisible ici. */
  videoUid?: string | null;
  vertical?: boolean;
};

export function PlayLinkPage({ path, content }: { path: string; content: PlayLinkContent | null }) {
  return (
    <div className="min-h-[80vh] bg-[#071719] px-4 py-10 text-slate-100">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 md:flex-row md:items-start">
        <div
          className={`relative w-full shrink-0 overflow-hidden rounded-2xl bg-black ${
            content?.vertical ? "aspect-[9/16] max-w-[300px]" : "aspect-[2/3] max-w-[280px]"
          }`}
        >
          {content?.videoUid ? (
            // Composant client : la miniature Stream se calcule chez lui (une
            // fonction d'un module « use client » ne s'appelle pas côté serveur).
            <ProductVideoPlayer uid={content.videoUid} thumbnail={content.image} title={content.title} />
          ) : content?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={content.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Clapperboard className="h-14 w-14 text-[#5EEAD4]" />
            </div>
          )}
        </div>

        <div className="flex w-full flex-col items-center text-center md:items-start md:text-left">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#5EEAD4]">
            {content ? content.kicker : "Rivendy Play"}
          </p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-white md:text-4xl">
            {content ? content.title : "Cette vidéo n’est plus disponible"}
          </h1>
          {content?.subtitle ? <p className="mt-2 text-sm font-semibold text-slate-300">{content.subtitle}</p> : null}
          {content?.description ? (
            <p className="mt-4 line-clamp-6 whitespace-pre-line text-sm leading-6 text-slate-300">{content.description}</p>
          ) : null}
          <p className="mt-6 text-sm text-slate-400">
            {content
              ? "Regardez-la en entier, commentez et suivez ses créateurs dans l’application Rivendy."
              : "Découvrez les films, séries, clips et Shorts de Rivendy Play dans l’application Rivendy."}
          </p>

          <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <a
              href={PLAY_STORE_URL}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#00BFA5] px-6 text-sm font-black text-[#071719] transition hover:bg-[#5EEAD4]"
            >
              <Download className="h-4 w-4" />
              Télécharger Rivendy
            </a>
            <a
              href={appIntentUrl(path)}
              className="flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 px-6 text-sm font-bold text-white transition hover:bg-white/10"
            >
              <Smartphone className="h-4 w-4" />
              J’ai déjà l’application
            </a>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Application Android gratuite. Déjà installée ? Mettez-la à jour pour ouvrir ce lien directement.
          </p>
          <Link href="/" className="mt-8 text-sm font-semibold text-[#5EEAD4] underline-offset-4 hover:underline">
            Voir la marketplace Rivendy
          </Link>
        </div>
      </div>
    </div>
  );
}
