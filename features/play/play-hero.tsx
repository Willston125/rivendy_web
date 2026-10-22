"use client";

import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Info, Play } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { fetchEpisodes } from "./play-api";
import {
  ageLabel, countLabel, currentEpisode, heroKicker, kindOf, landscapeArt, metaParts, playImage, playSrcSet,
  posterArt, resumeAt, titlePath, watchHref,
  type PlayEpisode, type PlayTitle, type WatchProgress,
} from "./play-logic";
import { ListButton, PIXEL, PremiumBadge, btnGhost, btnPrimary } from "./play-ui";

/**
 * Bannière « salle de cinéma » de Rivendy Play (refonte du 2026-10-22,
 * affinée le même jour : une vraie scène d'ouverture).
 *
 * L'image occupe TOUTE la bannière, avec les VRAIES images du titre :
 * - fond paysage (dashboard, « Image de fond 16:9 ») : plein cadre sur grand
 *   écran, sujet à droite, aucune affiche posée devant ;
 * - sinon (cas des titres actuels, qui n'ont qu'une affiche portrait) :
 *   extension floutée et assombrie de l'affiche sur toute la bannière, et
 *   l'affiche ENTIÈRE, nette, devant — jamais étirée ni recadrée sur un
 *   visage.
 * Voile vert sombre à gauche (titre et boutons lisibles), bas fondu dans la
 * page. Hauteur : `--rvp-hero` — sur un écran de 1366 × 768, le catalogue
 * commence dans le premier écran. Chaque format ne télécharge que son image
 * (`<picture>` + pixel vide).
 *
 * Sélection MANUELLE (aucun défilement automatique) : indicateurs, flèches,
 * touches ← →. Fondus coupés si l'on réduit les animations.
 */

/** Hauteur de la bannière sur grand écran (variable lue par la bannière et les fiches). */
export const HERO_HEIGHT = "[--rvp-hero:clamp(420px,calc(100svh_-_290px),620px)]";

/** La scène : extension floutée (ou fond paysage net), voile vert à gauche, bas fondu. */
export function TitleBackdrop({ title, priority }: { title: PlayTitle; priority?: boolean }) {
  const wide = landscapeArt(title);
  const source = posterArt(title) ?? wide;
  return (
    <div aria-hidden className="rvp-fade-in absolute inset-0 -z-10 overflow-hidden bg-rvp-ground">
      {source ? (
        // Extension de l'image du titre, floutée et assombrie : toute la bannière
        // sur téléphone ; sur grand écran, les trois quarts droits (sujet à
        // droite), fondus vers le texte.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={playImage(source, 720) ?? source} alt="" decoding="async" loading={wide ? "lazy" : "eager"}
          className={cn(
            "absolute inset-0 h-full w-full scale-110 object-cover object-[50%_28%] blur-xl brightness-[0.62] saturate-[1.15]",
            "lg:left-auto lg:w-[78%] lg:[mask-image:linear-gradient(to_right,transparent,black_45%)]",
            wide && "lg:hidden",
          )} />
      ) : null}
      {wide ? (
        <picture>
          <source media="(min-width: 1024px)" srcSet={playSrcSet(wide, [1080, 1440, 1920]) ?? wide} sizes="100vw" />
          <img src={PIXEL} alt="" decoding="async" fetchPriority={priority ? "high" : "auto"}
            className="absolute inset-0 hidden h-full w-full object-cover object-[70%_30%] lg:block" />
        </picture>
      ) : null}
      {/* Voile vert sombre : à gauche sur grand écran, partout sur téléphone. */}
      <div className="absolute inset-0 bg-rvp-ground/45 lg:bg-transparent lg:bg-gradient-to-r lg:from-rvp-ground lg:from-0% lg:via-rvp-ground/55 lg:via-35% lg:to-transparent lg:to-70%" />
      {/* Bas fondu dans la page ; haut assombri sous l'en-tête. */}
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-rvp-ground via-rvp-ground/50 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-rvp-ground/60 to-transparent" />
    </div>
  );
}

/**
 * Affiche entière : devant l'extension floutée sur grand écran (seulement sans
 * fond paysage), carte au-dessus du texte sur téléphone.
 */
export function PosterFrame({ title, priority, place }: { title: PlayTitle; priority?: boolean; place: "desktop" | "mobile" }) {
  const poster = posterArt(title);
  if (!poster) return null;
  const desktop = place === "desktop";
  return (
    <picture className={desktop ? "hidden lg:block" : "block lg:hidden"}>
      <source media={desktop ? "(min-width: 1024px)" : "(max-width: 1023.98px)"}
        srcSet={playSrcSet(poster, desktop ? [480, 720, 1080] : [320, 480, 720]) ?? poster}
        sizes={desktop ? "(min-width: 1536px) 360px, 300px" : "min(48vw, 200px)"} />
      <img src={PIXEL} alt={`Affiche de ${title.title}`} decoding="async" fetchPriority={priority ? "high" : "auto"}
        className={cn(
          "rvp-fade-in aspect-[2/3] rounded-2xl object-cover shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95)] ring-1 ring-white/15",
          // Grand écran : hauteur tirée de la bannière (jamais étirée : largeur d'après les proportions).
          // Téléphone : assez petite pour que la première rangée se voie vite.
          desktop ? "h-[calc(var(--rvp-hero)_-_7rem)] max-h-[520px] w-auto" : "w-[min(48vw,200px)]",
        )} />
    </picture>
  );
}

/** Téléphone, titre sans affiche mais avec un fond paysage (un clip) : le fond en tête. */
export function MobileWideArt({ title, priority }: { title: PlayTitle; priority?: boolean }) {
  const wide = landscapeArt(title);
  if (!wide || posterArt(title)) return null;
  return (
    <picture>
      <source media="(max-width: 1023.98px)" srcSet={playSrcSet(wide, [480, 720, 1080]) ?? wide} sizes="100vw" />
      <img src={PIXEL} alt="" decoding="async" fetchPriority={priority ? "high" : "auto"}
        className="rvp-fade-in aspect-video w-full rounded-2xl object-cover ring-1 ring-white/10 lg:hidden" />
    </picture>
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
export function PrimaryAction({ title, progress, episodes, size = "lg" }: {
  title: PlayTitle; progress: WatchProgress[]; episodes: PlayEpisode[] | null; size?: "lg" | "md";
}) {
  const cls = cn(btnPrimary, size === "md" && "h-11 px-5 text-sm");
  if (kindOf(title.kind) === "serie") {
    if (episodes === null) return <Link href={titlePath(title)} className={cls}><Play className="h-5 w-5 fill-current" aria-hidden /> Regarder</Link>;
    const mine = progress.filter((p) => p.title_id === title.id);
    const { episode } = currentEpisode(episodes, mine);
    if (!episode) return <Link href={titlePath(title)} className={cls}>Voir la série</Link>;
    return (
      <Link href={`/play/watch/episode/${episode.id}`} className={cls}>
        <Play className="h-5 w-5 fill-current" aria-hidden />
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
      <Play className="h-5 w-5 fill-current" aria-hidden /> {at > 0 ? "Reprendre" : kindOf(title.kind) === "clip" ? "Regarder le clip" : "Regarder"}
    </Link>
  );
}

/** Ligne de métadonnées : année · type · genre · durée, âge, Rivendy+. */
export function MetaLine({ title, episodes, className }: { title: PlayTitle; episodes?: number; className?: string }) {
  const parts = metaParts(title, episodes);
  const age = ageLabel(title.age_rating);
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2.5 gap-y-2 text-sm text-rvp-soft", className)}>
      {parts.map((p, i) => (
        <span key={`${p}-${i}`} className="flex items-center gap-2.5">
          {i > 0 ? <span aria-hidden className="text-rvp-muted">•</span> : null}
          {p}
        </span>
      ))}
      {age ? (
        <span className="rounded border border-white/30 px-1.5 text-xs font-semibold leading-5 text-rvp-text" title="Classification du titre">{age}</span>
      ) : null}
      {title.is_premium && kindOf(title.kind) !== "clip" ? <PremiumBadge /> : null}
    </div>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center justify-center gap-3 text-[11px] font-bold uppercase tracking-[0.22em] text-rvp-accent sm:text-xs lg:justify-start">
      <span aria-hidden className="h-px w-8 bg-rvp-accent" />
      {children}
    </p>
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

  const go = (n: number) => setIndex(((n % count) + count) % count);
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (count < 2 || (e.target as HTMLElement).closest("input, textarea, select")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); }
  };
  const wide = !!landscapeArt(title);

  const controls = count > 1 ? (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => go(i - 1)} aria-label="Titre précédent"
        className="hidden h-10 w-10 items-center justify-center rounded-full border border-white/20 text-rvp-soft transition-colors hover:border-white/40 hover:text-rvp-text lg:flex">
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <div className="flex items-center" role="group" aria-label="Choisir le titre à la une">
        {titles.map((t, n) => (
          <button key={t.id} type="button" onClick={() => go(n)} aria-current={n === i ? "true" : undefined}
            aria-label={`Afficher « ${t.title} » (${n + 1} sur ${count})`}
            className="flex h-11 items-center px-1">
            <span className={cn("block h-[3px] rounded-full transition-all duration-300 motion-reduce:transition-none",
              n === i ? "w-10 bg-rvp-accent" : "w-5 bg-white/30 hover:bg-white/60")} />
          </button>
        ))}
      </div>
      <p className="text-xs font-semibold tabular-nums tracking-[0.18em] text-rvp-muted" aria-hidden>
        <span className="text-rvp-text">{countLabel(i + 1)}</span> / {countLabel(count)}
      </p>
      <button type="button" onClick={() => go(i + 1)} aria-label="Titre suivant"
        className="hidden h-10 w-10 items-center justify-center rounded-full border border-white/20 text-rvp-soft transition-colors hover:border-white/40 hover:text-rvp-text lg:flex">
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
    </div>
  ) : null;

  return (
    <section aria-roledescription="carrousel" aria-label="À la une sur Rivendy Play" onKeyDown={onKeyDown}
      className={cn("relative isolate overflow-hidden lg:h-[var(--rvp-hero)]", HERO_HEIGHT)}>
      <TitleBackdrop key={`bg-${title.id}`} title={title} priority />
      <div className="relative mx-auto grid h-full w-full max-w-[1600px] items-center gap-6 px-4 pb-8 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12 lg:px-10 lg:py-0">
        <div key={`art-${title.id}`} className="flex justify-center lg:hidden">
          <PosterFrame title={title} priority place="mobile" />
          <MobileWideArt title={title} priority />
        </div>
        <div key={`txt-${title.id}`} className="rvp-rise-in min-w-0 text-center lg:max-w-[640px] lg:pb-6 lg:text-left"
          role="group" aria-roledescription="diapositive" aria-label={`${i + 1} sur ${count}`}>
          <Kicker>Rivendy Play <span aria-hidden>·</span> {heroKicker(title, now)}</Kicker>
          <h2 className="mt-4 break-words text-[clamp(2.25rem,4.6vw,4.5rem)] font-black leading-[0.98] tracking-tight text-rvp-text">
            {title.title}
          </h2>
          <MetaLine title={title} episodes={episodes?.length} className="mt-4 justify-center lg:justify-start" />
          {title.synopsis?.trim() ? (
            <p className="mx-auto mt-4 line-clamp-3 max-w-xl text-[15px] leading-7 text-rvp-soft lg:mx-0 lg:line-clamp-2">{title.synopsis.trim()}</p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 lg:mt-7 lg:justify-start">
            <PrimaryAction title={title} progress={progress} episodes={episodes} />
            <ListButton title={title} />
            {/* Téléphone : l'icône seule, pour garder les trois actions sur une ligne. */}
            <Link href={titlePath(title)} aria-label="Plus d’infos" className={cn(btnGhost, "w-12 px-0 sm:w-auto sm:px-3")}>
              <Info className="h-5 w-5" aria-hidden /> <span className="hidden sm:inline">Plus d’infos</span>
            </Link>
          </div>
          {controls ? <div className="mt-6 flex justify-center lg:hidden">{controls}</div> : null}
        </div>
        {/* Sans fond paysage : l'affiche entière devant son extension floutée. */}
        {!wide ? (
          <div key={`frame-${title.id}`} className="hidden self-start pt-8 lg:block">
            <PosterFrame title={title} priority place="desktop" />
          </div>
        ) : null}
      </div>
      {controls ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 hidden lg:block">
          <div className="pointer-events-auto mx-auto flex w-full max-w-[1600px] justify-end px-10">{controls}</div>
        </div>
      ) : null}
    </section>
  );
}

export function HeroSkeleton() {
  const pulse = "animate-pulse bg-rvp-surface motion-reduce:animate-none";
  return (
    <div aria-hidden className={cn("lg:h-[var(--rvp-hero)]", HERO_HEIGHT)}>
      <div className="mx-auto grid h-full w-full max-w-[1600px] items-center gap-6 px-4 pb-8 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12 lg:px-10 lg:py-0">
        <div className={cn("mx-auto aspect-[2/3] w-[min(48vw,200px)] rounded-2xl lg:hidden", pulse)} />
        <div className="flex flex-col items-center gap-4 lg:items-start">
          <div className={cn("h-3 w-48 rounded", pulse)} />
          <div className={cn("h-14 w-4/5 max-w-lg rounded-lg", pulse)} />
          <div className={cn("h-4 w-60 rounded", pulse)} />
          <div className="mt-4 flex gap-3">
            <div className={cn("h-12 w-36 rounded-lg", pulse)} />
            <div className={cn("h-12 w-32 rounded-lg", pulse)} />
          </div>
        </div>
        <div className={cn("hidden aspect-[2/3] h-[calc(var(--rvp-hero)_-_7rem)] max-h-[520px] self-start rounded-2xl lg:mt-8 lg:block", pulse)} />
      </div>
    </div>
  );
}
