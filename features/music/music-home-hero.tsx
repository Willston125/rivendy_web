"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { DEFAULT_TINT, useCoverTint } from "./music-collection";
import { artistName, releaseKindLabel, releaseYear, type MusicRelease } from "./music-logic";
import { Cover, PlayReleaseLabelButton, PremiumTag, SaveReleaseButton } from "./music-ui";

/**
 * Haut de l'accueil (refonte du 2026-10-28, maquette « Monte le son. ») :
 * l'accroche, les filtres de genre et la sortie à la une. Panneau large : une
 * seule scène, texte à gauche, pochette dominante à droite avec un disque qui
 * dépasse derrière, lumières vertes en dégradés (.rvm-stage). Panneau
 * étroit : l'accroche, puis une carte empilée (pochette, titre, boutons).
 * Aucune image de plus que la pochette : la connexion est souvent lente.
 */
export function HomeHero({ intro, release, kicker, hitBadge = false, loading = false }: {
  /** Accroche et filtres : dans la scène sur panneau large, au-dessus de la carte sinon. */
  intro: ReactNode;
  release: MusicRelease | null;
  kicker?: string;
  /** « N° 1 du Rivendy Hit » : seulement si la sortie l'est vraiment (heroHitBadge). */
  hitBadge?: boolean;
  /** Catalogue en chargement : la scène garde sa place, la carte attend. */
  loading?: boolean;
}) {
  const tint = useCoverTint(release?.cover_url);
  const [r, g, b] = tint ?? DEFAULT_TINT;
  // Rien à mettre à la une (genre sans sortie, catalogue vide) : l'accroche seule.
  if (!release && !loading) return <div>{intro}</div>;

  const meta = release ? [releaseKindLabel(release.kind), releaseYear(release)].filter(Boolean).join(" · ") : "";
  return (
    <section aria-labelledby={release ? "rvm-hero-title" : undefined} aria-busy={loading || undefined}
      style={{ "--hero": `${r} ${g} ${b}` } as CSSProperties}
      className="relative @2xl:grid @2xl:min-h-[22.5rem] @2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] @2xl:overflow-hidden @2xl:rounded-2xl @2xl:border @2xl:border-white/5">
      <div aria-hidden className="rvm-stage absolute inset-0 hidden @2xl:block" />

      <div className="relative flex min-w-0 flex-col @2xl:py-6 @2xl:pl-8 @2xl:pr-2">
        {intro}
        <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/5 p-4 @2xl:mt-auto @2xl:max-w-[30rem] @2xl:bg-rvm-ground/65 @2xl:px-6 @2xl:pb-5 @2xl:pt-4">
          <div aria-hidden className="rvm-stage-stacked absolute inset-0 @2xl:hidden" />
          {release ? (
            <>
              <HeroArt release={release} className="mb-4 justify-start @2xl:hidden" />
              <div className="relative">
                <p className="flex flex-wrap items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-rvm-accent">
                  {kicker}
                  {hitBadge ? (
                    <span className="rounded-full bg-rvm-accent/15 px-2 py-0.5 text-[11px] font-bold normal-case tracking-normal">N° 1 du Rivendy Hit</span>
                  ) : null}
                </p>
                <h2 id="rvm-hero-title" className="mt-1.5 line-clamp-2 break-words font-rvm-display text-[clamp(1.875rem,4.4cqw,2.75rem)] font-extrabold leading-[1.04] tracking-tight">
                  <Link href={`/music/album/${release.id}`} className="hover:underline">{release.title}</Link>
                </h2>
                <p className="mt-1.5 truncate text-[17px] font-semibold">
                  {release.artist_id ? <Link href={`/artist/${release.artist_id}`} className="hover:underline">{artistName(release)}</Link> : artistName(release)}
                </p>
                <p className="mt-0.5 flex items-center gap-2 text-sm text-rvm-soft">
                  {meta}{release.is_premium ? <PremiumTag /> : null}
                </p>
                {release.description ? (
                  <p className="mt-2 line-clamp-2 hidden max-w-md text-sm text-rvm-soft @4xl:block">{release.description}</p>
                ) : null}
                <div className="mt-4 flex items-center gap-3">
                  <PlayReleaseLabelButton release={release} label="Écouter maintenant" className="h-12 flex-1 px-6 text-[15px] @md:flex-none" />
                  <SaveReleaseButton release={release} variant="icon" />
                </div>
              </div>
            </>
          ) : (
            <div aria-hidden className="relative space-y-3">
              <div className="aspect-square w-[min(14rem,62%)] rounded-[10px] bg-rvm-raised motion-safe:animate-pulse @2xl:hidden" />
              <div className="h-3 w-24 rounded bg-rvm-raised motion-safe:animate-pulse" />
              <div className="h-9 w-3/4 rounded bg-rvm-raised motion-safe:animate-pulse" />
              <div className="h-4 w-1/3 rounded bg-rvm-raised/70 motion-safe:animate-pulse" />
              <div className="h-12 w-52 rounded-full bg-rvm-raised motion-safe:animate-pulse" />
            </div>
          )}
        </div>
      </div>

      {release ? <HeroArt release={release} className="relative hidden justify-center pr-[12%] @2xl:flex" /> : null}
    </section>
  );
}

/** Pochette dominante et disque qui dépasse derrière : du décor (le titre est écrit à côté). */
function HeroArt({ release, className }: { release: MusicRelease; className?: string }) {
  return (
    <div aria-hidden className={cn("relative flex items-center", className)}>
      <div className="relative w-[min(14rem,62%)] @2xl:w-[min(18rem,72%)]">
        <span className="rvm-vinyl absolute left-[36%] top-[5%] aspect-square w-[90%]">
          <Cover url={release.cover_url} size={480} alt="" rounded="rounded-full"
            className="absolute left-1/2 top-1/2 w-[30%] -translate-x-1/2 -translate-y-1/2" />
        </span>
        <Cover url={release.cover_url} size={480} alt="" priority rounded="rounded-[10px]"
          className="relative w-full shadow-[0_30px_70px_rgb(0_0_0/0.65)] ring-1 ring-white/10" />
      </div>
    </div>
  );
}
