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
 * Bannière « La sélection Rivendy » (style « fraîcheur », 2026-10-29,
 * référence du propriétaire) : vert lagon à gauche, photo joyeuse à droite,
 * « Lancer la sélection » joue les sorties de la sélection (ordre du
 * dashboard), sinon les dernières sorties. La photo vient de la maquette du
 * propriétaire (public/music/une-danse.webp) ; en économie de données, elle
 * est épargnée et la bannière reste en vert plein.
 */
export function SelectionHero({ releases }: { releases: MusicRelease[] }) {
  const player = useMusicPlayer();
  const market = useHomeMarket();
  const [busy, setBusy] = useState(false);
  const light = useSyncExternalStore(noSubscribe, lightData, () => false);
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
          <button type="button" onClick={play} disabled={releases.length === 0}
            className="inline-flex h-12 items-center gap-2.5 rounded-full bg-rvm-accent px-6 text-base font-extrabold text-rvm-on-accent shadow-lg shadow-black/25 transition hover:bg-rvm-accent-hover active:bg-rvm-accent-pressed disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? <LoaderCircle className="h-5 w-5 motion-safe:animate-spin" aria-hidden />
              : playing ? <Pause className="h-5 w-5 fill-current" aria-hidden /> : <Play className="h-5 w-5 fill-current" aria-hidden />}
            {isThis ? (playing ? "Pause" : "Reprendre") : "Lancer la sélection"}
          </button>
        </div>
      </div>
    </section>
  );
}

/** Attente de la bannière : sa place et sa couleur, sans photo. */
export function SelectionHeroSkeleton() {
  return <div aria-hidden className="h-80 rounded-3xl bg-rvm-deep/90 motion-safe:animate-pulse @2xl:h-[17.5rem]" />;
}

/**
 * Affiche sponsorisée de la Musique (format 2,7:1 du dashboard, onglet
 * « Musique »), toujours marquée « Sponsorisé », pleine image (couleurs
 * d'origine, rien posé dessus), jamais montrée aux abonnés Rivendy+ (le
 * parent ne la rend pas). Une vue comptée par affiche et par session.
 */
export function MusicAdBanner({ ad, className }: { ad: Advertisement; className?: string }) {
  useEffect(() => { trackAdView(ad.id); }, [ad.id]);
  const href = ad.link_type === "none" ? null : hrefForAd(ad);
  const body = (
    <>
      <Image src={ad.image_url} alt={ad.title || "Publicité"} fill sizes="(min-width: 1024px) 900px, 100vw" className="object-cover" />
      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-extrabold text-rvm-text shadow-sm">
        Sponsorisé
      </span>
    </>
  );
  const box = cn("relative block aspect-[1600/600] w-full overflow-hidden rounded-2xl bg-rvm-raised shadow-lg shadow-rvm-deep/15", className);
  if (!href) return <div className={box}>{body}</div>;
  return isExternalAd(ad) ? (
    <a href={href} target="_blank" rel="noopener noreferrer sponsored" onClick={() => trackAdClick(ad.id)} className={box}>{body}</a>
  ) : (
    <Link href={href} prefetch={false} onClick={() => trackAdClick(ad.id)} className={box}>{body}</Link>
  );
}
