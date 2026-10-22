"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Clapperboard, Loader2, Lock, Play, Plus, X, type LucideIcon } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { cn } from "@/lib/utils/cn";
import {
  countLabel, kindLabel, kindOf, landscapeArt, metaParts, playImage, playSrcSet, posterArt, titlePath,
  type PlayTitle, type WatchProgress,
} from "./play-logic";
import { usePlayList } from "./play-list";

/**
 * Rivendy Play sur le site — briques visuelles de la refonte « salle de
 * cinéma » (2026-10-22). Couleurs : jetons --rvp-* de app/site.css (fonds
 * vert profond, blanc cassé, vert de la marque ; or réservé à Rivendy+).
 * Images : seulement les vraies images du catalogue, redimensionnées sans
 * recadrage (play-logic `playImage`) et chargées quand elles approchent.
 */

/** Image transparente d'un pixel : rien n'est téléchargé hors du format affiché. */
export const PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export const btnPrimary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-rvp-accent px-6 text-[15px] font-bold text-rvp-on-accent transition-colors hover:bg-rvp-accent-hover active:bg-rvp-accent-pressed disabled:opacity-60";
export const btnSecondary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-5 text-[15px] font-semibold text-rvp-text backdrop-blur-md transition-colors hover:border-white/35 hover:bg-white/15 disabled:opacity-60";
export const btnGhost =
  "inline-flex h-12 items-center justify-center gap-2 rounded-lg px-3 text-[15px] font-semibold text-rvp-soft transition-colors hover:text-rvp-text";

/** Conteneur des pages Play : toute la largeur, marges régulières. */
export function PlayPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1600px] px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10", className)}>{children}</div>;
}

export function PageHeading({ title, intro, count, unit = "titre" }: { title: string; intro?: string; count?: number | null; unit?: string }) {
  return (
    <header className="mb-6 lg:mb-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-black tracking-tight text-rvp-text sm:text-4xl">{title}</h1>
        {count != null ? <Count n={count} unit={unit} /> : null}
      </div>
      {intro ? <p className="mt-2 max-w-2xl text-sm leading-6 text-rvp-soft sm:text-[15px]">{intro}</p> : null}
    </header>
  );
}

function Count({ n, unit }: { n: number; unit: string }) {
  return (
    <span className="rounded-md border border-rvp-line px-1.5 py-0.5 text-xs font-semibold tabular-nums text-rvp-muted">
      <span aria-hidden>{countLabel(n)}</span>
      <span className="sr-only">{n} {unit}{n > 1 ? "s" : ""}</span>
    </span>
  );
}

export function Spinner({ label = "Chargement…" }: { label?: string }) {
  return (
    <div role="status" className="py-16 text-center text-rvp-muted">
      <Loader2 className="mx-auto h-7 w-7 animate-spin motion-reduce:animate-none" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon = Clapperboard, title, text, children }: {
  icon?: LucideIcon; title: string; text?: string; children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rvp-accent/10 text-rvp-accent ring-1 ring-rvp-accent/25">
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <h2 className="mt-5 text-lg font-bold text-rvp-text">{title}</h2>
      {text ? <p className="mt-2 text-sm leading-6 text-rvp-soft">{text}</p> : null}
      {children ? <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div> : null}
    </div>
  );
}

export function ErrorState({ text = "Impossible de charger Rivendy Play. Vérifiez votre connexion.", onRetry }: { text?: string; onRetry: () => void }) {
  return (
    <div role="alert">
      <EmptyState icon={AlertTriangle} title="Chargement impossible" text={text}>
        <button type="button" onClick={onRetry} className={btnSecondary}>Réessayer</button>
      </EmptyState>
    </div>
  );
}

/** Rivendy+ : l'or est réservé à cette marque (comme dans la Musique). */
export function PremiumBadge({ solid }: { solid?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-rvp-premium",
      solid ? "bg-black/75 ring-1 ring-rvp-premium/40" : "bg-rvp-premium/10 ring-1 ring-rvp-premium/30",
    )}>
      <Lock className="h-3 w-3" aria-hidden /> Rivendy+
    </span>
  );
}

/**
 * Image du catalogue : tailles proposées au navigateur (`srcset`), chargée à
 * l'approche (lazy) sauf demande contraire, repli propre si elle échoue.
 */
export function PlayImg({ src, widths, sizes, alt = "", className, eager, fallback }: {
  src: string | null; widths: readonly number[]; sizes: string; alt?: string; className?: string; eager?: boolean; fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return <>{fallback ?? null}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={playImage(src, widths[Math.min(1, widths.length - 1)]) ?? src}
      srcSet={playSrcSet(src, widths)}
      sizes={sizes}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eager ? "high" : "auto"}
      onError={() => setFailed(src)}
      className={className}
    />
  );
}

/** Sans image : dégradé vert sobre, icône et titre (jamais une image inventée). */
function ArtFallback({ title, wide }: { title: string; wide?: boolean }) {
  return (
    <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-br from-rvp-raised via-rvp-surface to-rvp-ground p-3">
      <Clapperboard className={cn("text-rvp-accent/70", wide ? "mb-auto h-7 w-7" : "mb-auto h-6 w-6")} aria-hidden />
      <span className="line-clamp-3 text-sm font-bold leading-tight text-rvp-soft">{title}</span>
    </div>
  );
}

/** Part déjà vue d'un titre, d'après les positions du compte. */
export function progressRatio(progress: WatchProgress[], titleId: string): number | null {
  const p = progress.find((x) => x.title_id === titleId);
  return p && p.duration_seconds > 0 ? p.position_seconds / p.duration_seconds : null;
}

function ProgressBar({ ratio, className }: { ratio: number; className?: string }) {
  const pct = Math.max(2, Math.min(100, Math.round(ratio * 100)));
  return (
    <span className={cn("absolute inset-x-3 bottom-2.5 h-1 overflow-hidden rounded-full bg-white/25", className)} role="presentation">
      <span className="block h-full rounded-full bg-rvp-accent" style={{ width: `${pct}%` }} />
    </span>
  );
}

/**
 * « Ma liste » en bouton rond, posé À CÔTÉ du lien de la carte (jamais
 * dedans) : l'ajouter ne lance ni la fiche ni la lecture. Visible au survol
 * et au clavier sur ordinateur, toujours visible au toucher.
 */
export function ListToggle({ titleId, label, className }: { titleId: string; label: string; className?: string }) {
  const list = usePlayList();
  const on = list.has(titleId);
  const busy = list.busy(titleId);
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={busy}
      aria-label={on ? `Retirer « ${label} » de Ma liste` : `Ajouter « ${label} » à Ma liste`}
      title={on ? "Retirer de Ma liste" : "Ajouter à Ma liste"}
      onClick={() => void list.toggle(titleId, label)}
      className={cn(
        "rvp-reveal flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition-colors",
        on ? "border-rvp-accent bg-rvp-accent text-rvp-on-accent" : "border-white/40 bg-black/50 text-white hover:border-white hover:bg-black/70",
        className,
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
        : on ? <Check className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
    </button>
  );
}

/** « Ma liste » en grand bouton (bannière, fiche). */
export function ListButton({ title }: { title: Pick<PlayTitle, "id" | "title"> }) {
  const list = usePlayList();
  const on = list.has(title.id);
  return (
    <button type="button" aria-pressed={on} disabled={list.busy(title.id)}
      onClick={() => void list.toggle(title.id, title.title)} className={btnSecondary}>
      {list.busy(title.id) ? <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden />
        : on ? <Check className="h-5 w-5 text-rvp-accent" aria-hidden /> : <Plus className="h-5 w-5" aria-hidden />}
      {on ? "Dans ma liste" : "Ma liste"}
    </button>
  );
}

/** Ligne sous une carte : l'artiste d'un clip, sinon « 2023 · Action · 14 min » (« Film » va de soi). */
function cardMeta(title: PlayTitle): string {
  if (kindOf(title.kind) === "clip" && title.artist) return title.artist;
  return metaParts(title).filter((p) => !(kindOf(title.kind) === "film" && p === "Film")).join(" · ");
}

/** Affiche portrait 2:3 (catalogues, Ma liste, rangées par type). */
export function PosterCard({ title, rank, progress, sizes = "(min-width: 1536px) 14vw, (min-width: 1024px) 17vw, (min-width: 640px) 28vw, 42vw", eager }: {
  title: PlayTitle; rank?: number; progress?: number | null; sizes?: string; eager?: boolean;
}) {
  const meta = cardMeta(title);
  return (
    <article className="rvp-card group relative">
      <Link href={titlePath(title)} className="block rounded-xl">
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-rvp-surface ring-1 ring-white/5 transition duration-300 group-hover:ring-rvp-accent/70 motion-safe:group-hover:-translate-y-1">
          <PlayImg src={posterArt(title)} widths={[160, 320, 480, 720]} sizes={sizes} eager={eager}
            className="absolute inset-0 h-full w-full object-cover" fallback={<ArtFallback title={title.title} />} />
          <span className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/75 to-transparent" aria-hidden />
          {rank ? (
            <span aria-hidden className="absolute bottom-1 left-2 text-6xl font-black leading-none text-rvp-text drop-shadow-[0_3px_10px_rgba(0,0,0,0.85)]">
              {rank}
            </span>
          ) : null}
          {title.is_premium && title.kind !== "clip" ? <span className="absolute left-2 top-2"><PremiumBadge solid /></span> : null}
          {progress != null && progress > 0 ? <ProgressBar ratio={progress} /> : null}
        </div>
        <p className="mt-2.5 line-clamp-1 text-sm font-semibold text-rvp-text transition-colors group-hover:text-rvp-accent">
          {rank ? <span className="sr-only">N° {rank} : </span> : null}{title.title}
        </p>
        <p className="line-clamp-1 text-xs text-rvp-muted">{meta || kindLabel(title.kind)}</p>
      </Link>
      <ListToggle titleId={title.id} label={title.title} className="absolute right-2 top-2 z-10" />
    </article>
  );
}

/**
 * Carte paysage 16:9 (découverte, clips, « Continuer à regarder »). Avec un
 * vrai fond paysage : l'image, le titre dessus. Avec l'affiche seulement :
 * l'affiche ENTIÈRE à gauche sur son ambiance floutée, le texte à droite —
 * jamais une affiche recadrée en bandeau.
 */
export function LandscapeCard({ title, href, kicker, caption, progress, onRemove, removeLabel, sizes = "(min-width: 1536px) 24vw, (min-width: 1024px) 31vw, (min-width: 640px) 45vw, 82vw", eager }: {
  title: PlayTitle; href?: string; kicker?: string; caption?: string; progress?: number | null;
  onRemove?: () => void; removeLabel?: string; sizes?: string; eager?: boolean;
}) {
  const wide = landscapeArt(title);
  const poster = posterArt(title);
  const top = kicker ?? [kindLabel(title.kind), title.genre?.trim()].filter(Boolean).join(" · ");
  const meta = kindOf(title.kind) === "clip" && title.artist
    ? title.artist
    : metaParts(title).filter((p) => p !== kindLabel(title.kind) && p !== title.genre?.trim()).join(" · ");
  return (
    <article className="rvp-card group relative">
      <Link href={href ?? titlePath(title)} className="block rounded-xl">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-rvp-surface ring-1 ring-white/5 transition duration-300 group-hover:ring-rvp-accent/70">
          {wide ? (
            <>
              <PlayImg src={wide} widths={[480, 720, 1080]} sizes={sizes} eager={eager}
                className="absolute inset-0 h-full w-full object-cover transition duration-500 motion-safe:group-hover:scale-[1.03]" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" aria-hidden />
              <span className="absolute inset-x-4 bottom-3.5 block pr-12">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-rvp-accent">{top}</span>
                <span className="mt-1 line-clamp-2 block text-lg font-extrabold leading-tight text-rvp-text sm:text-xl">{title.title}</span>
              </span>
            </>
          ) : poster ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={playImage(poster, 160) ?? poster} alt="" aria-hidden loading="lazy" decoding="async"
                className="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-2xl saturate-150" />
              <span className="absolute inset-0 bg-gradient-to-r from-rvp-ground/85 via-rvp-ground/55 to-rvp-ground/25" aria-hidden />
              <span className="relative flex h-full items-stretch gap-3 p-3 sm:gap-4 sm:p-4">
                <PlayImg src={poster} widths={[160, 320, 480]} sizes="(min-width: 1024px) 170px, 130px" eager={eager}
                  className="aspect-[2/3] h-full w-auto shrink-0 rounded-lg object-cover shadow-[0_12px_30px_-10px_rgba(0,0,0,0.9)] ring-1 ring-white/10 transition duration-500 motion-safe:group-hover:scale-[1.03]" />
                <span className="flex min-w-0 flex-1 flex-col justify-end pb-0.5 pr-11">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-rvp-accent">{top}</span>
                  <span className="mt-1 line-clamp-3 block text-lg font-extrabold leading-tight text-rvp-text sm:text-xl">{title.title}</span>
                  {meta ? <span className="mt-1 line-clamp-1 block text-xs text-rvp-soft">{meta}</span> : null}
                </span>
              </span>
            </>
          ) : (
            <ArtFallback title={title.title} wide />
          )}
          <span aria-hidden className="absolute bottom-3.5 right-3.5 flex h-10 w-10 items-center justify-center rounded-full border border-white/50 bg-black/35 text-white backdrop-blur-sm transition-colors group-hover:border-rvp-accent group-hover:bg-rvp-accent group-hover:text-rvp-on-accent">
            <Play className="h-4 w-4 translate-x-px fill-current" />
          </span>
          {progress != null && progress > 0 ? <ProgressBar ratio={progress} className="right-16" /> : null}
        </div>
        {caption ? <p className="mt-2 line-clamp-1 text-xs text-rvp-muted">{caption}</p> : null}
      </Link>
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label={removeLabel ?? `Retirer « ${title.title} »`} title={removeLabel}
          className="rvp-reveal absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-black/55 text-white backdrop-blur-md transition-colors hover:border-white hover:bg-black/75">
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : (
        <ListToggle titleId={title.id} label={title.title} className="absolute right-2 top-2 z-10" />
      )}
    </article>
  );
}

export type RailLayout = "landscape" | "poster";

const RAIL_COLS: Record<RailLayout, string> = {
  landscape:
    "auto-cols-[82%] gap-3 sm:auto-cols-[calc((100%_-_1rem)/2.15)] sm:gap-4 lg:auto-cols-[calc((100%_-_2.5rem)/3)] lg:gap-5 2xl:auto-cols-[calc((100%_-_3.75rem)/4)]",
  poster:
    "auto-cols-[40%] gap-3 sm:auto-cols-[calc((100%_-_3rem)/4.3)] sm:gap-4 lg:auto-cols-[calc((100%_-_6.25rem)/6)] lg:gap-5 2xl:auto-cols-[calc((100%_-_7.5rem)/7)]",
};

/**
 * Rangée horizontale : glissement au doigt (accroché à chaque carte), flèches
 * sur ordinateur, défilement au clavier par la tabulation. Ne déborde jamais
 * de la page : seul le rail défile.
 */
export function Rail({ label, layout, children }: { label: string; layout: RailLayout; children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const start = el.scrollLeft <= 4;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onScroll) : null;
    ro?.observe(el);
    onScroll();
    return () => { cancelAnimationFrame(frame); el.removeEventListener("scroll", onScroll); ro?.disconnect(); };
  }, [measure]);

  const go = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: smooth ? "smooth" : "auto" });
  };

  const arrow = "absolute top-0 z-20 hidden h-[calc(100%-0.5rem)] w-14 items-center justify-center text-white [@media(hover:hover)]:flex";
  return (
    <div className="relative">
      <ul ref={ref} aria-label={label}
        className={cn(
          "no-scrollbar -mx-4 grid snap-x snap-mandatory grid-flow-col overflow-x-auto overscroll-x-contain scroll-px-4 px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:-mx-10 lg:scroll-px-10 lg:px-10",
          RAIL_COLS[layout],
        )}>
        {children}
      </ul>
      {!edges.start ? (
        <button type="button" onClick={() => go(-1)} aria-label={`${label} : titres précédents`}
          className={cn(arrow, "-left-4 bg-gradient-to-r from-rvp-ground via-rvp-ground/70 to-transparent sm:-left-6 lg:-left-10")}>
          <ChevronLeft className="h-8 w-8 drop-shadow" aria-hidden />
        </button>
      ) : null}
      {!edges.end ? (
        <button type="button" onClick={() => go(1)} aria-label={`${label} : titres suivants`}
          className={cn(arrow, "-right-4 bg-gradient-to-l from-rvp-ground via-rvp-ground/70 to-transparent sm:-right-6 lg:-right-10")}>
          <ChevronRight className="h-8 w-8 drop-shadow" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function RailItem({ children }: { children: ReactNode }) {
  return <li className="min-w-0 snap-start">{children}</li>;
}

/** En-tête de rangée : titre, compteur, « Tout voir ». */
export function SectionHeader({ id, title, count, href, total }: { id: string; title: string; count?: number; href?: string; total?: number }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <h2 id={id} className="truncate text-xl font-bold tracking-tight text-rvp-text sm:text-2xl">{title}</h2>
        {count != null ? <Count n={count} unit="titre" /> : null}
      </div>
      {href ? (
        <Link href={href} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-rvp-soft transition-colors hover:text-rvp-accent">
          Tout voir{total != null && count != null && total > count ? ` (${total})` : ""}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

export function Section({ id, title, count, href, total, children, className }: {
  id: string; title: string; count?: number; href?: string; total?: number; children: ReactNode; className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("mt-10 lg:mt-14", className)}>
      <SectionHeader id={id} title={title} count={count} href={href} total={total} />
      {children}
    </section>
  );
}

/** Grilles des catalogues : affiches (films, séries) ou paysage (clips). */
export function PosterGrid({ children }: { children: ReactNode }) {
  return <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 lg:gap-x-5 xl:grid-cols-6 2xl:grid-cols-7">{children}</ul>;
}
export function LandscapeGrid({ children }: { children: ReactNode }) {
  return <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5 2xl:grid-cols-4">{children}</ul>;
}

// ── Chargement ─────────────────────────────────────────────────────────────

const pulse = "animate-pulse rounded-xl bg-rvp-surface motion-reduce:animate-none";

export function RailSkeleton({ layout }: { layout: RailLayout }) {
  return (
    <div aria-hidden className="mt-10 lg:mt-14">
      <div className={cn(pulse, "mb-4 h-7 w-44 rounded-md")} />
      <div className={cn("grid grid-flow-col overflow-hidden", RAIL_COLS[layout])}>
        {Array.from({ length: layout === "poster" ? 7 : 4 }, (_, i) => (
          <div key={i} className={cn(pulse, layout === "poster" ? "aspect-[2/3]" : "aspect-video")} />
        ))}
      </div>
    </div>
  );
}

export function GridSkeleton({ layout }: { layout: RailLayout }) {
  const Grid = layout === "poster" ? PosterGrid : LandscapeGrid;
  return (
    <div aria-hidden>
      <Grid>
        {Array.from({ length: layout === "poster" ? 12 : 6 }, (_, i) => (
          <li key={i} className={cn(pulse, layout === "poster" ? "aspect-[2/3]" : "aspect-video")} />
        ))}
      </Grid>
    </div>
  );
}

// ── Compte et marché ───────────────────────────────────────────────────────

/** Lien de connexion qui ramène sur la page courante. */
export function useLoginHref(): string {
  const pathname = usePathname();
  return `/auth/login?next=${encodeURIComponent(pathname || "/play")}`;
}

/** Invitation discrète à se connecter (reprise, Ma liste). */
export function LoginNote({ text }: { text: string }) {
  const href = useLoginHref();
  const { user, loading } = useAuth();
  if (loading || user) return null;
  return (
    <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-rvp-line bg-gradient-to-r from-rvp-surface to-rvp-panel px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:mt-14 lg:px-7">
      <p className="text-sm leading-6 text-rvp-soft sm:text-[15px]">{text}</p>
      <Link href={href} className={cn(btnSecondary, "shrink-0")}>Se connecter</Link>
    </div>
  );
}

/** Aucun pays connu (visiteur sans compte) : le catalogue dépend du marché. */
export function MarketPrompt() {
  const { countries, setCountryId, loading } = useCountry();
  if (loading) return <Spinner />;
  return (
    <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-rvp-line bg-rvp-surface px-5 py-6 sm:px-7">
      <h2 className="text-lg font-bold text-rvp-text">Dans quel pays êtes-vous ?</h2>
      <p className="mt-1 text-sm text-rvp-soft">Le catalogue de Rivendy Play dépend de votre pays.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {countries.map((c) => (
          <button key={c.id} type="button" onClick={() => void setCountryId(c.id)}
            className="h-10 rounded-full bg-rvp-raised px-4 text-sm font-semibold text-rvp-text transition-colors hover:bg-rvp-accent hover:text-rvp-on-accent">
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Puces de filtre (genres, saisons) : un état clair, cibles de 40 px. */
export function FilterChips<T extends string | number>({ label, options, value, onChange, allLabel }: {
  label: string; options: Array<{ value: T; label: string }>; value: T | null; onChange: (v: T | null) => void; allLabel?: string;
}) {
  const chip = (active: boolean) => cn(
    "h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors",
    active ? "bg-rvp-accent text-rvp-on-accent" : "bg-rvp-raised text-rvp-soft hover:bg-rvp-line hover:text-rvp-text",
  );
  return (
    <div role="group" aria-label={label} className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
      {allLabel ? (
        <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={chip(value === null)}>{allLabel}</button>
      ) : null}
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} className={chip(value === o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
