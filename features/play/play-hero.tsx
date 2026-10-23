"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Info, Play, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { fetchEpisodes } from "./play-api";
import {
  ageLabel, countLabel, currentEpisode, heroBadge, kindOf, landscapeArt, metaParts, playImage, playSrcSet, posterArt,
  resumeAt, titlePath, watchHref,
  type PlayEpisode, type PlayTitle, type WatchProgress,
} from "./play-logic";
import { Chip, ListButton, PremiumBadge, btnIcon, btnPrimary } from "./play-ui";

/**
 * Bannière de Rivendy Play — mise en page « application » du 2026-10-23
 * (maquette du propriétaire) : une CARTE à bords arrondis, le texte à
 * gauche, la scène à droite, avec les VRAIES images du titre :
 * - fond paysage (dashboard, « Image de fond 16:9 ») : plein cadre sur la
 *   droite, fondu vers le texte — le rendu exact de la maquette ;
 * - sinon (titres actuels : une affiche portrait seulement) : l'affiche
 *   ENTIÈRE, nette, sur son extension floutée — jamais étirée ni recadrée
 *   sur un visage. (Le visuel paysage de la maquette était une image de
 *   démonstration générée, pas un fichier officiel.)
 * La carte se règle sur SA largeur (@container) : texte à côté de la scène
 * dès 576 px, affiche au-dessus du texte en dessous. Une seule image
 * téléchargée par titre (l'affiche nette et son ambiance : même adresse).
 *
 * Sélection MANUELLE (aucun défilement automatique) : flèches, indicateurs,
 * touches ← →, glissement du doigt. Fondus coupés si l'on réduit les
 * animations.
 */

/** Fond de la scène : fond paysage, ou extension floutée de l'affiche ; voile vers le texte. */
function SceneArt({ title, priority }: { title: PlayTitle; priority?: boolean }) {
  const wide = landscapeArt(title);
  const ambient = posterArt(title) ?? wide;
  return (
    <div aria-hidden key={title.id} className="rvp-fade-in absolute inset-0 -z-10 overflow-hidden">
      {wide ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={playImage(wide, 1080) ?? wide} srcSet={playSrcSet(wide, [720, 1080, 1440, 1920])}
          sizes="(min-width: 1280px) 60vw, 100vw" alt="" decoding="async" fetchPriority={priority ? "high" : "auto"}
          className="absolute inset-x-0 top-0 aspect-video w-full object-cover @min-[36rem]:inset-y-0 @min-[36rem]:left-auto @min-[36rem]:aspect-auto @min-[36rem]:h-full @min-[36rem]:w-[74%] @min-[36rem]:object-[60%_30%] @min-[36rem]:[mask-image:linear-gradient(to_right,transparent,black_40%)]" />
      ) : ambient ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={playImage(ambient, 480) ?? ambient} alt="" decoding="async"
          className="absolute inset-0 h-full w-full scale-125 object-cover object-[50%_25%] blur-2xl brightness-[0.5] saturate-[1.2] @min-[36rem]:left-auto @min-[36rem]:w-[80%] @min-[36rem]:[mask-image:linear-gradient(to_right,transparent,black_42%)]" />
      ) : null}
      {/* Voile : vers le bas en petit format (le texte est sous l'image), vers la gauche en grand format. */}
      <div className="absolute inset-0 bg-gradient-to-b from-rvp-deep/10 via-rvp-deep/75 to-rvp-deep @min-[36rem]:bg-gradient-to-r @min-[36rem]:from-rvp-deep @min-[36rem]:from-25% @min-[36rem]:via-rvp-deep/70 @min-[36rem]:via-50% @min-[36rem]:to-rvp-deep/0" />
      <div className="absolute inset-x-0 bottom-0 hidden h-1/3 bg-gradient-to-t from-rvp-deep/80 to-transparent @min-[36rem]:block" />
    </div>
  );
}

/**
 * L'affiche entière, nette : au-dessus du texte en petit format, à droite sur
 * son ambiance en grand format. Avec un fond paysage : la place de l'image
 * en tête de carte (petit format), rien en grand format.
 */
function ScenePoster({ title, priority }: { title: PlayTitle; priority?: boolean }) {
  if (landscapeArt(title)) return <div aria-hidden className="aspect-video w-full @min-[36rem]:hidden" />;
  const poster = posterArt(title);
  if (!poster) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={title.id} src={playImage(poster, 480) ?? poster} alt={`Affiche de ${title.title}`} decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className="rvp-fade-in relative mx-auto mt-6 aspect-[2/3] w-[min(44%,190px)] rounded-2xl object-cover shadow-[0_30px_70px_-28px_rgba(0,0,0,0.95)] ring-1 ring-white/15 @min-[36rem]:absolute @min-[36rem]:right-[7%] @min-[36rem]:top-1/2 @min-[36rem]:mt-0 @min-[36rem]:h-[calc(100%-6.5rem)] @min-[36rem]:max-h-[440px] @min-[36rem]:w-auto @min-[36rem]:-translate-y-1/2" />
  );
}

/**
 * Carte « scène » commune à la bannière d'accueil et aux fiches. `swipe` :
 * glissement horizontal du doigt (précédent / suivant), sans gêner le
 * défilement vertical de la page ; un glissement n'ouvre jamais un lien.
 */
export function SceneCard({ title, priority, label, roledescription, onKeyDown, swipe, overlay, children }: {
  title: PlayTitle; priority?: boolean; label?: string; roledescription?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
  swipe?: (dir: 1 | -1) => void;
  /** Posé sur la scène (marque, indicateurs). */
  overlay?: ReactNode;
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
      className={cn("@container relative isolate overflow-hidden rounded-[24px] border border-rvp-edge bg-rvp-deep", swipe && "touch-pan-y")}>
      <SceneArt title={title} priority={priority} />
      <div className="relative flex h-full flex-col @min-[36rem]:min-h-[var(--rvp-hero)]">
        <ScenePoster title={title} priority={priority} />
        {children}
      </div>
      {overlay}
    </section>
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

/** Action principale : regarder, reprendre, ou l'épisode à voir d'une série. */
export function PrimaryAction({ title, progress, episodes, className }: {
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

/** Ligne de métadonnées : « 2023 · Film · Action · 14 min », classification, Rivendy+. */
export function MetaLine({ title, episodes, className }: { title: PlayTitle; episodes?: number; className?: string }) {
  const parts = metaParts(title, episodes);
  const age = ageLabel(title.age_rating);
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px] text-rvp-soft", className)}>
      {parts.map((p, i) => (
        <span key={`${p}-${i}`} className="flex items-center gap-2">
          {i > 0 ? <span aria-hidden className="text-rvp-muted">·</span> : null}
          {p}
        </span>
      ))}
      {age ? (
        <span className="ml-1 rounded border border-white/25 px-1.5 text-[11px] font-semibold leading-5 text-rvp-text" title="Classification du titre">{age}</span>
      ) : null}
      {title.is_premium && kindOf(title.kind) !== "clip" ? <PremiumBadge /> : null}
    </div>
  );
}

export function PlayHero({ titles, progress }: { titles: PlayTitle[]; progress: WatchProgress[] }) {
  const [index, setIndex] = useState(0);
  const [now] = useState(() => new Date());
  const count = titles.length;
  const i = Math.min(index, Math.max(0, count - 1));
  const title = titles[i] ?? null;
  const episodes = useSeriesEpisodes(title);
  if (!title) return null;

  const multi = count > 1;
  const go = (n: number) => setIndex(((n % count) + count) % count);
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!multi || (e.target as HTMLElement).closest("input, textarea, select")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); }
  };
  const synopsis = title.synopsis?.trim();
  const round = "grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-rvp-deep/60 text-rvp-soft backdrop-blur-md transition-colors hover:border-white/35 hover:text-rvp-text";

  const dots = multi ? (
    <div className="flex items-center gap-2">
      <div className="flex items-center" role="group" aria-label="Choisir le titre à la une">
        {titles.map((t, n) => (
          <button key={t.id} type="button" onClick={() => go(n)} aria-current={n === i ? "true" : undefined}
            aria-label={`Afficher « ${t.title} » (${n + 1} sur ${count})`} className="flex h-11 items-center px-1">
            <span className={cn("block h-[3px] rounded-full transition-all duration-300 motion-reduce:transition-none",
              n === i ? "w-8 bg-rvp-accent" : "w-4 bg-white/25 hover:bg-white/50")} />
          </button>
        ))}
      </div>
      <p aria-hidden className="text-[11px] font-semibold tabular-nums tracking-[0.16em] text-rvp-muted">
        <span className="text-rvp-text">{countLabel(i + 1)}</span> / {countLabel(count)}
      </p>
    </div>
  ) : null;

  return (
    <SceneCard title={title} priority label="À la une sur Rivendy Play" roledescription="carrousel" onKeyDown={onKeyDown}
      swipe={multi ? (d) => go(i + d) : undefined}
      overlay={(
        <>
          <p aria-hidden className="pointer-events-none absolute right-6 top-6 hidden items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.34em] text-white/50 @min-[36rem]:flex">
            Rivendy Play <Play className="h-2 w-2 fill-current" />
          </p>
          {dots ? <div className="absolute bottom-3 right-5 hidden @min-[36rem]:block">{dots}</div> : null}
        </>
      )}>
      <div key={`txt-${title.id}`} role="group" aria-roledescription="diapositive" aria-label={`${i + 1} sur ${count}`}
        className="rvp-rise-in relative flex flex-1 flex-col items-center px-5 pb-4 pt-5 text-center @min-[36rem]:max-w-[58%] @min-[36rem]:items-start @min-[36rem]:px-8 @min-[36rem]:pb-5 @min-[36rem]:pt-7 @min-[36rem]:text-left">
        <Chip icon={Sparkles}>{heroBadge(title, now)}</Chip>
        <h2 className="mt-4 break-words text-[clamp(1.85rem,5.6cqi,3.4rem)] font-extrabold leading-[1.02] tracking-tight text-rvp-text">
          {title.title}
        </h2>
        <MetaLine title={title} episodes={episodes?.length} className="mt-4 justify-center @min-[36rem]:justify-start" />
        {synopsis ? (
          <p className="mt-3 line-clamp-3 max-w-md text-[14px] leading-6 text-rvp-soft @min-[36rem]:line-clamp-2">{synopsis}</p>
        ) : null}
        {/* Téléphone : « Regarder » sur toute la largeur, puis « Ma liste » et la fiche — même hauteur d'un titre à l'autre. */}
        <div className="mt-6 flex w-full flex-wrap items-center justify-center gap-2.5 @min-[36rem]:w-auto @min-[36rem]:justify-start">
          <PrimaryAction title={title} progress={progress} episodes={episodes} className="w-full @min-[36rem]:w-auto" />
          <ListButton title={title} className="flex-1 @min-[36rem]:flex-none" />
          <Link href={titlePath(title)} aria-label={`Fiche de « ${title.title} »`} title="Plus d’infos" className={btnIcon}>
            <Info className="h-[18px] w-[18px]" aria-hidden />
          </Link>
        </div>
        {multi ? (
          <div className="mt-auto flex w-full items-center justify-center pt-5 @min-[36rem]:justify-start">
            <div className="hidden items-center gap-2 @min-[36rem]:flex">
              <button type="button" onClick={() => go(i - 1)} aria-label="Titre précédent" className={round}>
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" onClick={() => go(i + 1)} aria-label="Titre suivant" className={round}>
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="@min-[36rem]:hidden">{dots}</div>
          </div>
        ) : null}
      </div>
    </SceneCard>
  );
}

export function HeroSkeleton() {
  const pulse = "animate-pulse bg-rvp-raised/70 motion-reduce:animate-none";
  return (
    <div aria-hidden className="@container relative overflow-hidden rounded-[24px] border border-rvp-edge bg-rvp-card">
      <div className="flex flex-col items-center gap-4 p-6 @min-[36rem]:min-h-[var(--rvp-hero)] @min-[36rem]:items-start @min-[36rem]:justify-center @min-[36rem]:p-8">
        <div className={cn("aspect-[2/3] w-[min(44%,190px)] rounded-2xl @min-[36rem]:hidden", pulse)} />
        <div className={cn("h-7 w-28 rounded-lg", pulse)} />
        <div className={cn("h-12 w-4/5 max-w-md rounded-lg", pulse)} />
        <div className={cn("h-4 w-56 rounded", pulse)} />
        <div className="mt-3 flex gap-3">
          <div className={cn("h-11 w-32 rounded-xl", pulse)} />
          <div className={cn("h-11 w-28 rounded-xl", pulse)} />
        </div>
      </div>
      <div className={cn("absolute right-[7%] top-1/2 hidden aspect-[2/3] h-[calc(100%-6.5rem)] -translate-y-1/2 rounded-2xl @min-[36rem]:block", pulse)} />
    </div>
  );
}
