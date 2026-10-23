"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle, ArrowRight, Check, ChevronLeft, ChevronRight, Clapperboard, Loader2, Lock, Music, Play, Plus, X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { cn } from "@/lib/utils/cn";
import {
  durationLabel, kindLabel, kindOf, landscapeArt, metaParts, playImage, playSrcSet, posterArt, tileKicker, tileMeta,
  titlePath, watchHref,
  type KindFilter, type PlayTitle, type WatchProgress,
} from "./play-logic";
import { usePlayList } from "./play-list";

/**
 * Rivendy Play sur le site — briques visuelles. Refonte « salle de cinéma »
 * (2026-10-22) reprise dans la mise en page « application » du 2026-10-23 :
 * cartes à bords arrondis sur fond vert profond, vignettes du catalogue avec
 * genre, titre et durée posés sur l'image (comme la maquette), un seul vert
 * d'accent (celui de la marque), l'or réservé à Rivendy+.
 * Couleurs : jetons --rvp-* de app/site.css. Images : seulement les vraies
 * images du catalogue, redimensionnées sans recadrage (`playImage`) et
 * chargées à l'approche.
 */

/** Image transparente d'un pixel : rien n'est téléchargé hors du format affiché. */
export const PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export const btnPrimary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rvp-accent px-5 text-[14.5px] font-bold text-rvp-on-accent shadow-[0_12px_32px_-16px_var(--rvp-accent)] transition-colors hover:bg-rvp-accent-hover active:bg-rvp-accent-pressed disabled:opacity-60";
export const btnSecondary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-rvp-edge bg-rvp-raised/70 px-4 text-[14.5px] font-semibold text-rvp-text backdrop-blur-md transition-colors hover:border-white/20 hover:bg-rvp-raised disabled:opacity-60";
export const btnGhost =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-[14.5px] font-semibold text-rvp-soft transition-colors hover:text-rvp-text";
/** Bouton carré à icône seule (fiche d'information de la bannière). */
export const btnIcon =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rvp-edge bg-rvp-raised/70 text-rvp-soft backdrop-blur-md transition-colors hover:border-white/20 hover:text-rvp-text";

/**
 * Contenu d'une page Play, dans le panneau central. Conteneur de requêtes
 * (`@container`) : grilles et rangées se règlent sur la largeur RÉELLE du
 * panneau (le menu latéral la réduit), pas sur celle de la fenêtre.
 */
export function PlayPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("@container mx-auto w-full max-w-[1480px] px-4 pb-6 pt-5 sm:px-6 lg:pt-7 xl:px-8", className)}>{children}</div>;
}

export function PageHeading({ title, intro, count, unit = "titre", children }: {
  title: string; intro?: string; count?: number | null; unit?: string; children?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 lg:mb-8">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-bold tracking-tight text-rvp-text sm:text-[32px]">{title}</h1>
          {count != null ? <CountChip n={count} unit={unit} /> : null}
        </div>
        {intro ? <p className="mt-1.5 max-w-2xl text-sm leading-6 text-rvp-muted sm:text-[15px]">{intro}</p> : null}
      </div>
      {children}
    </header>
  );
}

/** Pastille « 3 titres » d'un en-tête de rubrique. */
export function CountChip({ n, unit = "titre" }: { n: number; unit?: string }) {
  return (
    <span className="rounded-md border border-rvp-edge px-2 py-0.5 text-[11px] font-medium tabular-nums text-rvp-muted">
      {n} {unit}{n > 1 ? "s" : ""}
    </span>
  );
}

/** Petite pastille au-dessus d'un titre (« À la une », « Film · Action »). */
export function Chip({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-rvp-accent/30 bg-rvp-deep/70 px-2.5 py-1 text-[12px] font-medium text-rvp-soft backdrop-blur-md">
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-rvp-accent" aria-hidden /> : null}
      <span className="truncate">{children}</span>
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
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rvp-accent/10 text-rvp-accent ring-1 ring-rvp-accent/25">
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
    <div role="alert" className="rounded-[24px] border border-rvp-edge bg-rvp-card/60">
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
    <div className="absolute inset-0 flex flex-col justify-start bg-gradient-to-br from-rvp-raised via-rvp-card to-rvp-deep p-3.5">
      <Clapperboard className={cn("text-rvp-accent/70", wide ? "h-7 w-7" : "h-6 w-6")} aria-hidden />
      <span className="sr-only">{title}</span>
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
    <span className={cn("absolute inset-x-3.5 bottom-2.5 h-1 overflow-hidden rounded-full bg-white/20", className)} role="presentation">
      <span className="block h-full rounded-full bg-rvp-accent" style={{ width: `${pct}%` }} />
    </span>
  );
}

/**
 * « Ma liste » en bouton rond, posé À CÔTÉ du lien de la carte (jamais
 * dedans) : l'ajouter ne lance ni la fiche ni la lecture. Sur une image :
 * visible au survol et au clavier sur ordinateur, toujours au toucher. Dans
 * un panneau (`tone="panel"`) : toujours visible.
 */
export function ListToggle({ titleId, label, className, tone = "overlay" }: {
  titleId: string; label: string; className?: string; tone?: "overlay" | "panel";
}) {
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
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors",
        tone === "overlay" && "rvp-reveal backdrop-blur-md",
        on ? "border-rvp-accent bg-rvp-accent text-rvp-on-accent"
          : tone === "overlay" ? "border-white/40 bg-black/50 text-white hover:border-white hover:bg-black/70"
            : "border-rvp-edge text-rvp-soft hover:border-rvp-accent/60 hover:text-rvp-accent",
        className,
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
        : on ? <Check className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
    </button>
  );
}

/** « Ma liste » en grand bouton (bannière, fiche). */
export function ListButton({ title, className }: { title: Pick<PlayTitle, "id" | "title">; className?: string }) {
  const list = usePlayList();
  const on = list.has(title.id);
  return (
    <button type="button" aria-pressed={on} disabled={list.busy(title.id)}
      onClick={() => void list.toggle(title.id, title.title)} className={cn(btnSecondary, className)}>
      {list.busy(title.id) ? <Loader2 className="h-[18px] w-[18px] animate-spin motion-reduce:animate-none" aria-hidden />
        : on ? <Check className="h-[18px] w-[18px] text-rvp-accent" aria-hidden /> : <Plus className="h-[18px] w-[18px]" aria-hidden />}
      {on ? "Dans ma liste" : "Ma liste"}
    </button>
  );
}

const TILE_SIZES = "(min-width: 1280px) 22vw, (min-width: 1024px) 27vw, (min-width: 640px) 31vw, 47vw";

/**
 * Vignette du catalogue (maquette du 2026-10-23) : l'image remplit la carte,
 * genre, titre et durée posés dessus sur un fondu sombre. Image : l'affiche
 * officielle cadrée sur son haut (où sont les visages), sinon le visuel
 * paysage — jamais étirée. La lecture directe (« Continuer à regarder »)
 * passe par `href` ; « Ma liste » (ou « retirer ») reste hors du lien.
 */
export function TitleTile({ title, href, kicker, meta, progress, onRemove, removeLabel, eager, sizes = TILE_SIZES }: {
  title: PlayTitle; href?: string; kicker?: string; meta?: string; progress?: number | null;
  onRemove?: () => void; removeLabel?: string; eager?: boolean; sizes?: string;
}) {
  const art = posterArt(title) ?? landscapeArt(title);
  const top = kicker ?? tileKicker(title);
  const bottom = meta ?? tileMeta(title);
  return (
    <article className="rvp-card group relative">
      <Link href={href ?? titlePath(title)}
        className="relative block aspect-[11/10] overflow-hidden rounded-[18px] border border-white/10 bg-rvp-card transition duration-300 hover:border-rvp-accent/60 motion-safe:group-hover:-translate-y-0.5">
        <PlayImg src={art} widths={[320, 480, 720]} sizes={sizes} eager={eager}
          className="absolute inset-0 h-full w-full object-cover object-[50%_18%] transition duration-500 motion-safe:group-hover:scale-[1.04]"
          fallback={<ArtFallback title={title.title} />} />
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-[64%] bg-gradient-to-t from-rvp-deep via-rvp-deep/80 to-transparent" />
        {title.is_premium && kindOf(title.kind) !== "clip" ? <span className="absolute left-3 top-3"><PremiumBadge solid /></span> : null}
        <span className={cn("absolute inset-x-0 bottom-0 px-3.5 pt-3 sm:px-4", progress != null && progress > 0 ? "pb-6" : "pb-3.5 sm:pb-4")}>
          {top ? <span className="block truncate text-[11px] font-medium text-rvp-soft">{top}</span> : null}
          <span className="mt-0.5 line-clamp-2 text-[16px] font-bold leading-[1.2] tracking-tight text-rvp-text transition-colors group-hover:text-rvp-accent-hover sm:text-[19px]">
            {title.title}
          </span>
          {bottom ? <span className="mt-1 block truncate text-[12px] text-rvp-muted">{bottom}</span> : null}
        </span>
        {progress != null && progress > 0 ? <ProgressBar ratio={progress} /> : null}
      </Link>
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label={removeLabel ?? `Retirer « ${title.title} »`} title={removeLabel}
          className="rvp-reveal absolute right-2.5 top-2.5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-black/55 text-white backdrop-blur-md transition-colors hover:border-white hover:bg-black/75">
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : (
        <ListToggle titleId={title.id} label={title.title} className="absolute right-2.5 top-2.5 z-10" />
      )}
    </article>
  );
}

/** Ligne sous une carte : l'artiste d'un clip, sinon « 2023 · Action · 14 min » (« Film » va de soi). */
function cardMeta(title: PlayTitle): string {
  if (kindOf(title.kind) === "clip" && title.artist) return title.artist;
  return metaParts(title).filter((p) => !(kindOf(title.kind) === "film" && p === "Film")).join(" · ");
}

/** Affiche portrait 2:3 entière (rangées par type et classement d'un grand catalogue). */
export function PosterCard({ title, rank, progress, sizes = "(min-width: 1536px) 14vw, (min-width: 1024px) 17vw, (min-width: 640px) 28vw, 42vw", eager }: {
  title: PlayTitle; rank?: number; progress?: number | null; sizes?: string; eager?: boolean;
}) {
  const meta = cardMeta(title);
  return (
    <article className="rvp-card group relative">
      <Link href={titlePath(title)} className="block rounded-[18px]">
        <div className="relative aspect-[2/3] overflow-hidden rounded-[18px] border border-white/10 bg-rvp-card transition duration-300 group-hover:border-rvp-accent/60 motion-safe:group-hover:-translate-y-0.5">
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
 * Carte paysage 16:9 (clips : leur vraie vignette paysage). Titre et
 * métadonnées dessous ; lecture et « Ma liste » posés sur l'image, hors du
 * lien de la carte.
 */
export function LandscapeCard({ title, href, watch, kicker, caption, progress, onRemove, removeLabel, sizes = "(min-width: 1536px) 24vw, (min-width: 1024px) 31vw, (min-width: 640px) 45vw, 82vw", eager }: {
  title: PlayTitle; href?: string;
  /** Lecture directe (reprise d'une position) ; par défaut, le film ou le clip, les épisodes d'une série. */
  watch?: string; kicker?: string; caption?: string; progress?: number | null;
  onRemove?: () => void; removeLabel?: string; sizes?: string; eager?: boolean;
}) {
  const wide = landscapeArt(title);
  const art = wide ?? posterArt(title);
  const k = kindOf(title.kind);
  const meta = k === "clip" && title.artist
    ? [title.artist, durationLabel(title.duration_seconds)].filter(Boolean).join(" · ")
    : metaParts(title).join(" · ");
  const play = watch ?? watchHref(title) ?? `${titlePath(title)}#episodes`;
  const playLabel = watch || k !== "serie" ? `Regarder « ${title.title} »` : `Voir les épisodes de « ${title.title} »`;
  return (
    <article className="rvp-card group relative">
      <Link href={href ?? titlePath(title)} className="block rounded-[18px]">
        <div className="relative aspect-video overflow-hidden rounded-[18px] border border-white/10 bg-rvp-card transition duration-300 group-hover:border-rvp-accent/60">
          <PlayImg src={art} widths={[320, 480, 720, 1080]} sizes={sizes} eager={eager}
            className={cn("absolute inset-0 h-full w-full object-cover transition duration-500 motion-safe:group-hover:scale-[1.04]",
              wide ? "object-[50%_35%]" : "object-[50%_30%]")}
            fallback={<ArtFallback title={title.title} wide />} />
          <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 to-transparent" aria-hidden />
          {title.is_premium && k !== "clip" ? <span className="absolute left-2 top-2"><PremiumBadge solid /></span> : null}
          {progress != null && progress > 0 ? <ProgressBar ratio={progress} className="right-16" /> : null}
        </div>
        <span className="mt-3 block min-w-0">
          {kicker ? <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-rvp-accent">{kicker}</span> : null}
          <span className="block truncate text-base font-bold text-rvp-text transition-colors group-hover:text-rvp-accent">{title.title}</span>
          {caption || meta ? <span className="mt-0.5 block truncate text-sm text-rvp-muted">{caption ?? meta}</span> : null}
        </span>
      </Link>
      {/* Commandes posées sur l'image (même boîte 16:9), hors du lien de la carte. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 aspect-video">
        <Link href={play} aria-label={playLabel} title={playLabel}
          className="pointer-events-auto absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-rvp-accent text-rvp-on-accent shadow-[0_8px_20px_-6px_rgba(0,0,0,0.8)] transition-colors hover:bg-rvp-accent-hover">
          <Play className="h-[18px] w-[18px] translate-x-px fill-current" aria-hidden />
        </Link>
        {onRemove ? (
          <button type="button" onClick={onRemove} aria-label={removeLabel ?? `Retirer « ${title.title} »`} title={removeLabel}
            className="rvp-reveal pointer-events-auto absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-black/55 text-white backdrop-blur-md transition-colors hover:border-white hover:bg-black/75">
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <ListToggle titleId={title.id} label={title.title} className="pointer-events-auto absolute right-2 top-2" />
        )}
      </div>
    </article>
  );
}

/**
 * Carte « L'espace des talents » (maquette) : vers les clips des artistes,
 * ou vers les artistes de Rivendy Musique tant qu'aucun clip n'est publié.
 */
export function TalentsCard({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} prefetch={href.startsWith("/music") ? false : undefined}
      className="group relative flex aspect-[11/10] flex-col justify-between overflow-hidden rounded-[18px] border border-rvp-accent/25 bg-gradient-to-br from-rvp-accent/25 via-rvp-card to-rvp-card p-4 transition-colors hover:border-rvp-accent/60 sm:p-5">
      <span aria-hidden className="absolute -right-16 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full border border-rvp-accent/15" />
      <span aria-hidden className="absolute -right-4 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full border border-rvp-accent/25 bg-rvp-accent/[0.04]" />
      <Music aria-hidden className="absolute right-4 top-10 h-8 w-8 text-rvp-accent/80 transition-transform duration-500 motion-safe:group-hover:-rotate-6 sm:right-[13%] sm:top-[30%] sm:h-12 sm:w-12" />
      <span className="relative pr-10 text-[10px] font-bold uppercase tracking-[0.16em] text-rvp-soft sm:pr-0 sm:tracking-[0.2em]">L’espace des talents</span>
      <span className="relative">
        <span className="block text-[18px] leading-[1.15] tracking-tight text-rvp-text sm:text-[24px]">
          La scène<span className="block text-rvp-sage">est à vous.</span>
        </span>
        <span className="mt-3 flex items-center justify-between gap-2 text-[12px] font-semibold text-rvp-soft transition-colors group-hover:text-rvp-accent">
          {label} <ArrowRight className="h-4 w-4 shrink-0 transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden />
        </span>
      </span>
    </Link>
  );
}

export type RailLayout = "landscape" | "poster" | "tile";

// Largeurs réglées sur le panneau central (@container de PlayPage), écrites en entier : Tailwind les lit.
const RAIL_COLS: Record<RailLayout, string> = {
  landscape:
    "auto-cols-[82%] gap-3 @min-[40rem]:auto-cols-[calc((100%_-_1rem)/2.15)] @min-[40rem]:gap-4 @min-[56rem]:auto-cols-[calc((100%_-_2.5rem)/3)] @min-[56rem]:gap-5 @min-[80rem]:auto-cols-[calc((100%_-_3.75rem)/4)]",
  poster:
    "auto-cols-[40%] gap-3 @min-[40rem]:auto-cols-[calc((100%_-_3rem)/4.3)] @min-[40rem]:gap-4 @min-[56rem]:auto-cols-[calc((100%_-_6.25rem)/6)] @min-[56rem]:gap-5 @min-[80rem]:auto-cols-[calc((100%_-_7.5rem)/7)]",
  tile:
    "auto-cols-[47%] gap-3 @min-[40rem]:auto-cols-[calc((100%_-_2rem)/3.2)] @min-[40rem]:gap-4 @min-[56rem]:auto-cols-[calc((100%_-_3.75rem)/4)] @min-[56rem]:gap-5",
};

/**
 * Rangée horizontale : glissement au doigt (accroché à chaque carte), flèches
 * sur ordinateur, défilement au clavier par la tabulation. Ne déborde jamais
 * du panneau : seule la rangée défile.
 */
export function Rail({ label, layout, children }: { label: string; layout: RailLayout; count?: number; children: ReactNode }) {
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
          "no-scrollbar -mx-4 grid snap-x snap-mandatory grid-flow-col overflow-x-auto overscroll-x-contain scroll-px-4 px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 xl:-mx-8 xl:scroll-px-8 xl:px-8",
          RAIL_COLS[layout],
        )}>
        {children}
      </ul>
      {!edges.start ? (
        <button type="button" onClick={() => go(-1)} aria-label={`${label} : titres précédents`}
          className={cn(arrow, "-left-4 bg-gradient-to-r from-rvp-frame via-rvp-frame/70 to-transparent sm:-left-6 xl:-left-8")}>
          <ChevronLeft className="h-8 w-8 drop-shadow" aria-hidden />
        </button>
      ) : null}
      {!edges.end ? (
        <button type="button" onClick={() => go(1)} aria-label={`${label} : titres suivants`}
          className={cn(arrow, "-right-4 bg-gradient-to-l from-rvp-frame via-rvp-frame/70 to-transparent sm:-right-6 xl:-right-8")}>
          <ChevronRight className="h-8 w-8 drop-shadow" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function RailItem({ children }: { children: ReactNode }) {
  return <li className="min-w-0 snap-start">{children}</li>;
}

/** En-tête de rubrique : titre, « 3 titres », puis à droite « Tout voir » ou des filtres. */
export function SectionHeader({ id, title, count, href, total, unit, children }: {
  id: string; title: string; count?: number; href?: string; total?: number; unit?: string; children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 lg:mb-5">
      <div className="flex min-w-0 items-center gap-3">
        <h2 id={id} className="truncate text-[20px] font-bold tracking-tight text-rvp-text sm:text-[21px]">{title}</h2>
        {count != null ? <CountChip n={total ?? count} unit={unit} /> : null}
      </div>
      {children}
      {href ? (
        <Link href={href} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-rvp-soft transition-colors hover:text-rvp-accent">
          Tout voir <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

export function Section({ id, title, count, href, total, unit, children, className, actions }: {
  id: string; title: string; count?: number; href?: string; total?: number; unit?: string; children: ReactNode; className?: string; actions?: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn("mt-10 lg:mt-12", className)}>
      <SectionHeader id={id} title={title} count={count} href={href} total={total} unit={unit}>{actions}</SectionHeader>
      {children}
    </section>
  );
}

const KIND_LABELS: Record<KindFilter, string> = { all: "Tout", film: "Films", serie: "Séries" };

/** Filtre « Tout / Films / Séries » (maquette) : un groupe de boutons à bascule. */
export function KindSwitch({ label, options, value, onChange }: {
  label: string; options: KindFilter[]; value: KindFilter; onChange: (v: KindFilter) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl border border-rvp-edge bg-rvp-card/60 p-1">
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(o)}
          className={cn("h-9 min-w-14 rounded-lg px-3.5 text-[13px] font-semibold transition-colors",
            value === o ? "bg-rvp-raised text-rvp-text ring-1 ring-inset ring-white/10" : "text-rvp-muted hover:text-rvp-text")}>
          {KIND_LABELS[o]}
        </button>
      ))}
    </div>
  );
}

/** Grilles des catalogues (largeur du panneau central) : vignettes, affiches ou paysage (clips). */
export function TileGrid({ children, max = 5 }: { children: ReactNode; max?: 4 | 5 }) {
  return (
    <ul className={cn("grid grid-cols-2 gap-3 @min-[40rem]:grid-cols-3 @min-[40rem]:gap-4 @min-[56rem]:grid-cols-4 @min-[56rem]:gap-5",
      max === 5 && "@min-[80rem]:grid-cols-5")}>
      {children}
    </ul>
  );
}
export function PosterGrid({ children }: { children: ReactNode }) {
  return <ul className="grid grid-cols-2 gap-x-3 gap-y-6 @min-[40rem]:grid-cols-3 @min-[40rem]:gap-x-4 @min-[48rem]:grid-cols-4 @min-[64rem]:grid-cols-5 @min-[64rem]:gap-x-5 @min-[80rem]:grid-cols-6">{children}</ul>;
}
export function LandscapeGrid({ children }: { children: ReactNode }) {
  return <ul className="grid grid-cols-1 gap-4 @min-[36rem]:grid-cols-2 @min-[56rem]:grid-cols-3 @min-[56rem]:gap-5 @min-[80rem]:grid-cols-4">{children}</ul>;
}

// ── Chargement ─────────────────────────────────────────────────────────────

const pulse = "animate-pulse rounded-[18px] bg-rvp-card motion-reduce:animate-none";

const SHAPE: Record<RailLayout, string> = { poster: "aspect-[2/3]", landscape: "aspect-video", tile: "aspect-[11/10]" };

export function RailSkeleton({ layout }: { layout: RailLayout }) {
  return (
    <div aria-hidden className="mt-10 lg:mt-12">
      <div className={cn(pulse, "mb-4 h-7 w-44 rounded-md")} />
      <div className={cn("grid grid-flow-col overflow-hidden", RAIL_COLS[layout])}>
        {Array.from({ length: layout === "poster" ? 7 : 4 }, (_, i) => <div key={i} className={cn(pulse, SHAPE[layout])} />)}
      </div>
    </div>
  );
}

export function GridSkeleton({ layout, count }: { layout: RailLayout; count?: number }) {
  const n = count ?? (layout === "poster" ? 12 : layout === "tile" ? 8 : 6);
  const items = Array.from({ length: n }, (_, i) => <li key={i} className={cn(pulse, SHAPE[layout])} />);
  return (
    <div aria-hidden>
      {layout === "poster" ? <PosterGrid>{items}</PosterGrid> : layout === "tile" ? <TileGrid>{items}</TileGrid> : <LandscapeGrid>{items}</LandscapeGrid>}
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
    <div className="mt-10 flex flex-col gap-4 rounded-[20px] border border-rvp-edge bg-gradient-to-r from-rvp-card to-rvp-frame px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:mt-12 lg:px-7">
      <p className="text-sm leading-6 text-rvp-soft sm:text-[15px]">{text}</p>
      <Link href={href} prefetch={false} className={cn(btnSecondary, "shrink-0")}>Se connecter</Link>
    </div>
  );
}

/** Aucun pays connu (visiteur sans compte) : le catalogue dépend du marché. */
export function MarketPrompt() {
  const { countries, setCountryId, loading } = useCountry();
  if (loading) return <Spinner />;
  return (
    <div className="mx-auto mt-2 max-w-3xl rounded-[24px] border border-rvp-edge bg-rvp-card px-5 py-6 sm:px-7">
      <h2 className="text-lg font-bold text-rvp-text">Dans quel pays êtes-vous ?</h2>
      <p className="mt-1 text-sm text-rvp-soft">Le catalogue de Rivendy Play dépend de votre pays.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {countries.map((c) => (
          <button key={c.id} type="button" onClick={() => void setCountryId(c.id)}
            className="h-11 rounded-full border border-rvp-edge bg-rvp-raised/60 px-4 text-sm font-semibold text-rvp-text transition-colors hover:border-rvp-accent hover:bg-rvp-accent hover:text-rvp-on-accent">
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
    "h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors",
    active ? "border-rvp-accent bg-rvp-accent text-rvp-on-accent" : "border-rvp-edge bg-rvp-card/60 text-rvp-soft hover:border-white/20 hover:text-rvp-text",
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
