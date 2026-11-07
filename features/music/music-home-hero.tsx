"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { LoaderCircle, Music, Pause, Play } from "lucide-react";
import { hrefForAd, isExternalAd } from "@/features/ads/ad-link";
import { trackAdClick, trackAdView } from "@/features/ads/track";
import { useHomeMarket } from "@/features/media/use-home-market";
import { cn } from "@/lib/utils/cn";
import type { Advertisement } from "@/types/rivendy";
import { fetchTracksOfReleases } from "./music-api";
import { lightData } from "./music-collection";
import type { MusicRelease } from "./music-logic";
import { toQueue } from "./music-ui";
import { useMusicPlayer } from "./player/music-player-provider";

const noSubscribe = () => () => {};
const SOURCE = { label: "La sélection Rivendy", href: "/music" };

/**
 * Lecture de la sélection, partagée par la bannière et par le bouton posé
 * sous l'affiche sponsorisée : les sorties de la sélection (ordre du
 * dashboard), sinon les dernières sorties ; un 2e clic met en pause.
 */
function useSelectionPlay(releases: MusicRelease[]) {
  const player = useMusicPlayer();
  const market = useHomeMarket();
  const [busy, setBusy] = useState(false);
  const isThis = player.source?.label === SOURCE.label && !!player.current;
  const playing = isThis && player.playing;

  async function play() {
    if (isThis) { player.toggle(); return; }
    setBusy(true);
    try {
      const tracks = await fetchTracksOfReleases(releases.map((r) => r.id), market);
      player.playQueue(toQueue(tracks), 0, { source: SOURCE });
    } catch {
      // Panne réseau : le lecteur dit « aucun titre disponible ».
      player.playQueue([], 0);
    } finally {
      setBusy(false);
    }
  }

  return { play, busy, isThis, playing, disabled: releases.length === 0 };
}

function SelectionIcon({ busy, playing, className }: { busy: boolean; playing: boolean; className: string }) {
  if (busy) return <LoaderCircle className={cn(className, "motion-safe:animate-spin")} aria-hidden />;
  return playing ? <Pause className={cn(className, "fill-current")} aria-hidden /> : <Play className={cn(className, "fill-current")} aria-hidden />;
}

/**
 * Bannière « La sélection Rivendy » (style « fraîcheur », 2026-10-29,
 * référence du propriétaire) : vert lagon à gauche, photo joyeuse à droite,
 * « Lancer la sélection » joue la sélection. Elle tient le haut de l'accueil
 * quand aucune affiche sponsorisée n'est montrée (abonné Rivendy+, aucune pub
 * en ligne). La photo vient de la maquette du propriétaire
 * (public/music/une-danse.webp) ; en économie de données, elle est épargnée
 * et la bannière reste en vert plein.
 */
export function SelectionHero({ releases }: { releases: MusicRelease[] }) {
  const { play, busy, isThis, playing, disabled } = useSelectionPlay(releases);
  const light = useSyncExternalStore(noSubscribe, lightData, () => false);

  return (
    <section aria-labelledby="rvm-hero-title"
      className="rvm-deep relative overflow-hidden rounded-3xl shadow-xl shadow-rvm-deep/20 @2xl:h-[17.5rem]">
      {!light ? (
        <div className="relative h-40 @md:h-48 @2xl:absolute @2xl:inset-y-0 @2xl:right-0 @2xl:h-auto @2xl:w-[64%]">
          <Image src="/music/une-danse.webp" alt="" fill priority sizes="(min-width: 1024px) 720px, 100vw"
            className="object-cover object-[50%_30%]" />
          <span aria-hidden className="rvm-hero-veil-stacked absolute inset-0 @2xl:hidden" />
        </div>
      ) : null}
      <span aria-hidden className="rvm-hero-veil absolute inset-0 hidden @2xl:block" />
      <Music aria-hidden className="absolute left-[45%] top-7 hidden h-14 w-14 rotate-6 text-rvm-accent @2xl:block" strokeWidth={2.2} />
      <div className="relative px-5 pb-6 pt-3 @2xl:flex @2xl:h-full @2xl:max-w-[34rem] @2xl:flex-col @2xl:justify-center @2xl:px-9 @2xl:py-7">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-rvm-ink-accent @2xl:text-[13px]">La sélection Rivendy</p>
        {/* Deux lignes comme la référence (« Le son qui te / fait bouger. »), la note reste à côté. */}
        <h2 id="rvm-hero-title" className="mt-2 font-rvm-display text-[clamp(2rem,4.8cqw,3.4rem)] font-black leading-[0.95] tracking-tight @2xl:max-w-[11ch]">
          Le son qui te fait bouger.
        </h2>
        <p className="mt-3 text-[15px] font-semibold @2xl:text-lg">Les talents d’ici. L’énergie de partout.</p>
        <div className="mt-5">
          <button type="button" onClick={play} disabled={disabled}
            className="inline-flex h-12 items-center gap-2.5 rounded-full bg-rvm-accent px-6 text-base font-extrabold text-rvm-on-accent shadow-lg shadow-black/25 transition hover:bg-rvm-accent-hover active:bg-rvm-accent-pressed disabled:cursor-not-allowed disabled:opacity-50">
            <SelectionIcon busy={busy} playing={playing} className="h-5 w-5" />
            {isThis ? (playing ? "Pause" : "Reprendre") : "Lancer la sélection"}
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * Le bouton de la sélection quand l'affiche sponsorisée tient le haut : posé
 * sous l'affiche, en tête des filtres, jamais sur l'image (elle appartient à
 * l'annonceur et un clic dessus ouvre son lien).
 */
export function SelectionButton({ releases, className }: { releases: MusicRelease[]; className?: string }) {
  const { play, busy, isThis, playing, disabled } = useSelectionPlay(releases);
  return (
    <button type="button" onClick={play} disabled={disabled}
      aria-label={isThis ? (playing ? "Mettre en pause la sélection Rivendy" : "Reprendre la sélection Rivendy") : undefined}
      className={cn("inline-flex h-11 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full bg-rvm-accent pl-4 pr-5 text-[15px] font-extrabold text-rvm-on-accent shadow-md shadow-rvm-deep/20 transition hover:bg-rvm-accent-hover active:bg-rvm-accent-pressed disabled:cursor-not-allowed disabled:opacity-50", className)}>
      <SelectionIcon busy={busy} playing={playing} className="h-[18px] w-[18px]" />
      {isThis ? (playing ? "Pause" : "Reprendre") : "Lancer la sélection Rivendy"}
    </button>
  );
}

/**
 * Attente du haut de l'accueil : une place neutre au format de l'affiche,
 * ni verte ni pub, tant que l'on ne sait pas laquelle des deux viendra.
 */
export function HomeTopSkeleton() {
  return <div aria-hidden className="aspect-[1600/600] max-h-[21rem] w-full rounded-2xl bg-rvm-raised motion-safe:animate-pulse @2xl:rounded-3xl" />;
}

/**
 * Affiche sponsorisée de la Musique (format 2,7:1 du dashboard, onglet
 * « Musique »), en haut de l'accueil à la place de la bannière de la
 * sélection (2026-11-03) : jamais rognée — sa hauteur s'arrête à 336 px et,
 * sur un écran plus large, les côtés reprennent la même affiche, floutée
 * (même adresse et même `sizes` : aucun téléchargement de plus). Toujours
 * marquée « Sponsorisé », jamais montrée aux abonnés Rivendy+ (le parent ne
 * la rend pas). Une vue comptée par affiche et par session.
 */
export function MusicAdBanner({ ad, className }: { ad: Advertisement; className?: string }) {
  useEffect(() => { trackAdView(ad.id); }, [ad.id]);
  const href = ad.link_type === "none" ? null : hrefForAd(ad);
  const sizes = "(min-width: 1024px) 900px, 100vw";
  const body = (
    <>
      <Image src={ad.image_url} alt="" aria-hidden fill sizes={sizes}
        className="scale-110 object-cover blur-2xl brightness-[0.62] saturate-[1.1]" />
      <Image src={ad.image_url} alt={ad.title || "Publicité"} fill sizes={sizes} className="object-contain" />
      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-extrabold text-rvm-text shadow-sm @2xl:left-4 @2xl:top-4">
        Sponsorisé
      </span>
    </>
  );
  const box = cn("relative block aspect-[1600/600] max-h-[21rem] w-full overflow-hidden rounded-2xl bg-rvm-deep shadow-xl shadow-rvm-deep/20 @2xl:rounded-3xl", className);
  if (!href) return <div className={box}>{body}</div>;
  return isExternalAd(ad) ? (
    <a href={href} target="_blank" rel="noopener noreferrer sponsored" onClick={() => trackAdClick(ad.id)} className={box}>{body}</a>
  ) : (
    <Link href={href} prefetch={false} onClick={() => trackAdClick(ad.id)} className={box}>{body}</Link>
  );
}
