"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Info, Play } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { fetchEpisodes } from "./play-api";
import {
  ageLabel, countLabel, currentEpisode, heroBadge, heroTitleSize, kindOf, metaParts, playImage, playSrcSet, resumeAt,
  sceneArt, titlePath, watchHref,
  type HeroTitleSize, type PlayEpisode, type PlayTitle, type WatchProgress,
} from "./play-logic";
import { usePageBackdrop } from "./play-shell";
import { HERO_SIZES_POSTER, HERO_SIZES_WIDE, HERO_WIDTHS, btnIcon, btnPrimary, btnRound, display, eyebrow } from "./play-theme";
import { ListButton, PremiumBadge } from "./play-ui";

/**
 * Bannière de Rivendy Play — « key art » (« Emerald Cinema », 2026-10-24).
 * Ce n'est plus « le texte à gauche, l'affiche dans une carte à droite » :
 * l'image du titre EST la bannière.
 * - Fond paysage (dashboard, « Image de fond 16:9 ») : plein cadre.
 * - Sinon (titres actuels : une affiche portrait seulement) : l'affiche,
 *   grande, cadrée sur son haut (là où sont les visages), fondue vers le
 *   texte et vers le bas ; derrière elle, la même image floutée prolonge le
 *   décor sur toute la bannière. Jamais étirée (object-fit: cover).
 * Par-dessus : halo émeraude, voile côté texte (97 % → 75 % → 15 %), bas
 * assombri, vignettage et grain très léger (classes rvp-* de site.css).
 * Une seule image téléchargée par titre (même adresse et mêmes tailles pour
 * l'ambiance, l'image nette et l'ambiance de la page).
 *
 * Petit format (bannière < 576 px) : l'image en tête, en 4:5, le texte
 * dessous. Sélection MANUELLE (aucun défilement automatique) : flèches,
 * indicateurs, touches ← →, glissement du doigt. Changement de titre : l'image
 * se pose (fondu, léger zoom), le titre monte, le reste suit — une
 * bande-annonce silencieuse ; immobile si l'on réduit les animations.
 */

/** Image de la scène et sa place (`sizes`) : la même pour le décor, l'image nette et l'ambiance de la page. */
export function sceneImage(title: PlayTitle): { src: string | null; wide: boolean; sizes: string } {
  const { src, wide } = sceneArt(title);
  return { src, wide, sizes: wide ? HERO_SIZES_WIDE : HERO_SIZES_POSTER };
}

/** L'ambiance de la page reprend l'image de la scène (même adresse : rien de plus à télécharger). */
export function useSceneBackdrop(title: PlayTitle | null) {
  const scene = title ? sceneImage(title) : null;
  usePageBackdrop(scene?.src ?? null, HERO_WIDTHS, scene?.sizes ?? HERO_SIZES_POSTER);
}

/** Couches visuelles de la scène (décor, halo, image nette, voiles). */
function SceneLayers({ title, priority }: { title: PlayTitle; priority?: boolean }) {
  const { src, wide, sizes } = sceneImage(title);
  const img = src ? { src: playImage(src, 720) ?? src, srcSet: playSrcSet(src, HERO_WIDTHS), sizes } : null;
  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
      {img ? (
        <>
          {/* Le décor : l'image elle-même, floutée et assombrie, sur toute la bannière. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={`decor-${title.id}`} {...img} alt="" decoding="async"
            className="rvp-fade-in absolute inset-0 h-full w-full scale-125 object-cover object-[50%_20%] blur-2xl brightness-[0.42] saturate-[1.3]" />
          <div className="rvp-hero-glow absolute inset-0" />
          <div className="rvp-parallax absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={title.id} {...img} alt="" decoding="async" fetchPriority={priority ? "high" : "auto"}
              className={cn("rvp-art-in absolute object-cover", wide ? "rvp-art-wide" : "rvp-art-poster")} />
          </div>
        </>
      ) : (
        <div className="rvp-hero-glow absolute inset-0" />
      )}
      <div className="rvp-hero-veil rvp-grain absolute inset-0" />
    </div>
  );
}

/**
 * Scène commune à la bannière d'accueil et aux fiches (CinematicScene).
 * `swipe` : glissement horizontal du doigt (précédent / suivant), sans gêner
 * le défilement vertical ; un glissement n'ouvre jamais un lien.
 */
export function CinematicScene({ title, priority, label, roledescription, onKeyDown, swipe, className, children }: {
  title: PlayTitle; priority?: boolean; label?: string; roledescription?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
  swipe?: (dir: 1 | -1) => void;
  className?: string;
  children: ReactNode;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const onDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (!swipe || e.pointerType === "mouse") return;
    start.current = { x: e.clientX, y: e.clientY };
    swiped.current = false;
  };
  const onUp = (e: ReactPointerEvent<HTMLElement>) => {
    const s = start.current;
    start.current = null;
    if (!swipe || !s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped.current = true;
      swipe(dx < 0 ? 1 : -1);
    }
  };
  return (
    <section aria-label={label} aria-roledescription={roledescription} onKeyDown={onKeyDown}
      onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { start.current = null; }}
      onClickCapture={(e) => { if (swiped.current) { e.preventDefault(); e.stopPropagation(); swiped.current = false; } }}
      className={cn("@container relative isolate overflow-hidden rounded-rvp-hero border border-white/[0.07] bg-rvp-ground shadow-rvp-deep", swipe && "touch-pan-y", className)}>
      <SceneLayers title={title} priority={priority} />
      <div className="relative">{children}</div>
    </section>
  );
}

/** Taille du titre de la bannière (grand format : relative à la largeur de la bannière). */
export const HERO_TITLE: Record<HeroTitleSize, string> = {
  xl: "text-[clamp(2.75rem,8.6cqi,5.4rem)]",
  lg: "text-[clamp(2.4rem,6.8cqi,4.4rem)]",
  md: "text-[clamp(2rem,5.2cqi,3.4rem)]",
};

/** Le texte commence sous l'image en petit format (4:5 pour une affiche, 16:10 pour un fond paysage). */
export function sceneTextOffset(title: PlayTitle): string {
  const { src, wide } = sceneArt(title);
  if (!src) return "pt-10";
  return wide ? "pt-[calc(62.5cqi-4rem)]" : "pt-[calc(125cqi-7rem)]";
}

/** « RIVENDY PLAY ▶ | À LA UNE » : la marque, puis la raison réelle de la présence du titre. */
export function HeroEyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn(eyebrow, "flex items-center gap-2.5 text-rvp-accent", className)}>
      <span className="flex items-center gap-1.5">Rivendy Play <Play className="h-2.5 w-2.5 fill-current" aria-hidden /></span>
      <span aria-hidden className="h-3 w-px bg-white/30" />
      <span className="text-rvp-text">{children}</span>
    </p>
  );
}

/** Épisodes d'une série, lus une fois par série (pour « Regarder S1 É1 »). */
function useSeriesEpisodes(title: PlayTitle | null): PlayEpisode[] | null {
  const [byId, setById] = useState<Record<string, PlayEpisode[]>>({});
  const id = title && kindOf(title.kind) === "serie" ? title.id : null;
  const known = id ? byId[id] : undefined;
  useEffect(() => {
    if (!id || known) return;
    let alive = true;
    void fetchEpisodes(id).then((eps) => { if (alive) setById((m) => ({ ...m, [id]: eps })); }).catch(() => undefined);
    return () => { alive = false; };
  }, [id, known]);
  return id ? known ?? null : null;
}

/** Bouton de lecture (PlayButton) : regarder, reprendre, ou l'épisode à voir d'une série. */
export function PlayButton({ title, progress, episodes, className }: {
  title: PlayTitle; progress: WatchProgress[]; episodes: PlayEpisode[] | null; className?: string;
}) {
  const cls = cn(btnPrimary, className);
  if (kindOf(title.kind) === "serie") {
    if (episodes === null) return <Link href={titlePath(title)} className={cls}><Play className="h-[18px] w-[18px] fill-current" aria-hidden /> Regarder</Link>;
    const mine = progress.filter((p) => p.title_id === title.id);
    const { episode } = currentEpisode(episodes, mine);
    if (!episode) return <Link href={titlePath(title)} className={cls}>Voir la série</Link>;
    return (
      <Link href={`/play/watch/episode/${episode.id}`} className={cls}>
        <Play className="h-[18px] w-[18px] fill-current" aria-hidden />
        {mine.length > 0 ? "Reprendre" : "Regarder"}
        <span className="font-semibold opacity-80">S{episode.season} É{episode.episode_number}</span>
      </Link>
    );
  }
  const href = watchHref(title);
  if (!href) return null;
  const p = progress.find((x) => x.title_id === title.id && !x.episode_id);
  const at = p ? resumeAt(p.position_seconds, p.duration_seconds) : 0;
  return (
    <Link href={href} className={cls}>
      <Play className="h-[18px] w-[18px] fill-current" aria-hidden /> {at > 0 ? "Reprendre" : kindOf(title.kind) === "clip" ? "Regarder le clip" : "Regarder"}
    </Link>
  );
}

/** Métadonnées (HeroMetadata) : « 2023 · Film · Action · 14 min », classification, Rivendy+. */
export function HeroMetadata({ title, episodes, className }: { title: PlayTitle; episodes?: number; className?: string }) {
  const parts = metaParts(title, episodes);
  const age = ageLabel(title.age_rating);
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-2 text-[14px] font-medium text-rvp-soft", className)}>
      {parts.map((p, i) => (
        <span key={`${p}-${i}`} className="flex items-center gap-2">
          {i > 0 ? <span aria-hidden className="text-rvp-faint">·</span> : null}
          {p}
        </span>
      ))}
      {age ? (
        <span className="ml-1 rounded-md border border-white/30 bg-white/[0.06] px-1.5 text-[11px] font-semibold leading-5 text-rvp-text" title="Classification du titre">{age}</span>
      ) : null}
      {title.is_premium && kindOf(title.kind) !== "clip" ? <PremiumBadge /> : null}
    </div>
  );
}

/** Bannière de l'accueil (CinematicHero) : titre choisi par la page (`index`), pour que l'ambiance de la page le suive. */
export function CinematicHero({ titles, progress, index, onIndex, className }: {
  titles: PlayTitle[]; progress: WatchProgress[]; index: number; onIndex: (n: number) => void; className?: string;
}) {
  const [now] = useState(() => new Date());
  const count = titles.length;
  const i = Math.min(index, Math.max(0, count - 1));
  const title = titles[i] ?? null;
  const episodes = useSeriesEpisodes(title);
  if (!title) return null;

  const multi = count > 1;
  const go = (n: number) => onIndex(((n % count) + count) % count);
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!multi || (e.target as HTMLElement).closest("input, textarea, select")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); }
  };
  const synopsis = title.synopsis?.trim();

  const dots = multi ? (
    <div className="flex items-center gap-3">
      <div className="flex items-center" role="group" aria-label="Choisir le titre à la une">
        {titles.map((t, n) => (
          <button key={t.id} type="button" onClick={() => go(n)} aria-current={n === i ? "true" : undefined}
            aria-label={`Afficher « ${t.title} » (${n + 1} sur ${count})`} className="flex h-11 items-center px-1">
            <span className={cn("block h-[3px] rounded-full transition-all duration-(--rvp-slow) ease-rvp motion-reduce:transition-none",
              n === i ? "w-8 bg-rvp-accent shadow-rvp-dot" : "w-4 bg-white/25 hover:bg-white/50")} />
          </button>
        ))}
      </div>
      <p aria-hidden className="text-[12px] font-semibold tabular-nums tracking-[0.14em] text-rvp-muted">
        <span className="text-rvp-text">{countLabel(i + 1)}</span> / {countLabel(count)}
      </p>
    </div>
  ) : null;

  return (
    <CinematicScene title={title} priority label="À la une sur Rivendy Play" roledescription="carrousel" onKeyDown={onKeyDown}
      swipe={multi ? (d) => go(i + d) : undefined} className={className}>
      <div className={cn(
        "flex flex-col items-center px-5 pb-6 text-center @min-[36rem]:min-h-[var(--rvp-hero)] @min-[36rem]:items-start @min-[36rem]:justify-center @min-[36rem]:px-8 @min-[36rem]:pb-[4.5rem] @min-[36rem]:pt-12 @min-[36rem]:text-left @min-[48rem]:px-10",
        sceneTextOffset(title),
      )}>
        <div key={title.id} role="group" aria-roledescription="diapositive" aria-label={`${i + 1} sur ${count}`}
          className="flex w-full flex-col items-center @min-[36rem]:max-w-[68%] @min-[36rem]:items-start @min-[48rem]:max-w-[min(36rem,56%)]">
          <HeroEyebrow className="rvp-fade-in">{heroBadge(title, now)}</HeroEyebrow>
          {/* L'interligne APRÈS la taille : cn (tailwind-merge) retire un interligne placé avant une taille de police. */}
          <h2 className={cn("rvp-rise-in mt-4 text-balance break-words text-rvp-text", display, HERO_TITLE[heroTitleSize(title.title)], "leading-[0.95]")}>
            {title.title}
          </h2>
          <HeroMetadata title={title} episodes={episodes?.length} className="rvp-fade-in mt-5 justify-center @min-[36rem]:justify-start" />
          {synopsis ? (
            <p className="rvp-rise-in-late mt-4 line-clamp-3 max-w-[46ch] text-[15px] leading-6 text-rvp-soft @min-[36rem]:line-clamp-2">{synopsis}</p>
          ) : null}
          {/* Téléphone : « Regarder » sur toute la largeur, puis « Ma liste » et la fiche — même hauteur d'un titre à l'autre. */}
          <div className="rvp-rise-in-late mt-7 flex w-full flex-wrap items-center justify-center gap-3 @min-[36rem]:w-auto @min-[36rem]:justify-start">
            <PlayButton title={title} progress={progress} episodes={episodes} className="w-full @min-[36rem]:w-auto" />
            <ListButton title={title} className="flex-1 @min-[36rem]:flex-none" />
            <Link href={titlePath(title)} aria-label={`Fiche de « ${title.title} »`} title="Plus d’infos" className={btnIcon}>
              <Info className="h-[18px] w-[18px]" aria-hidden />
            </Link>
          </div>
        </div>
        {multi ? (
          <>
            <div className="mt-6 @min-[36rem]:hidden">{dots}</div>
            <div className="absolute inset-x-8 bottom-4 hidden items-center justify-between @min-[36rem]:flex @min-[48rem]:inset-x-10">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => go(i - 1)} aria-label="Titre précédent" className={btnRound}>
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                <button type="button" onClick={() => go(i + 1)} aria-label="Titre suivant" className={btnRound}>
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
              {dots}
            </div>
          </>
        ) : null}
      </div>
    </CinematicScene>
  );
}

export function HeroSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("@container relative overflow-hidden rounded-rvp-hero border border-white/[0.07] bg-rvp-ground", className)}>
      <div className="rvp-skeleton absolute inset-x-0 top-0 aspect-[4/5] @min-[36rem]:inset-y-0 @min-[36rem]:left-auto @min-[36rem]:aspect-auto @min-[36rem]:w-[58%]" />
      <div className="relative flex flex-col items-center gap-4 px-5 pb-6 pt-[calc(125cqi-6rem)] @min-[36rem]:min-h-[var(--rvp-hero)] @min-[36rem]:items-start @min-[36rem]:justify-center @min-[36rem]:px-10 @min-[36rem]:pt-10">
        <div className="rvp-skeleton h-3.5 w-40 rounded bg-rvp-raised" />
        <div className="rvp-skeleton h-14 w-4/5 max-w-sm rounded-lg bg-rvp-raised" />
        <div className="rvp-skeleton h-4 w-56 rounded bg-rvp-raised" />
        <div className="mt-3 flex gap-3">
          <div className="rvp-skeleton h-12 w-36 rounded-rvp bg-rvp-raised" />
          <div className="rvp-skeleton h-12 w-32 rounded-rvp bg-rvp-raised" />
        </div>
      </div>
    </div>
  );
}
