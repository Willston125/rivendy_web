"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Clapperboard, Loader2, Music, Play, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  durationLabel, kindLabel, kindOf, landscapeArt, metaParts, playImage, playSrcSet, posterArt, tileKicker, tileMeta,
  titlePath, watchHref,
  type PlayTitle,
} from "./play-logic";
import { usePlayList } from "./play-list";
import {
  CARD_SIZES, CARD_WIDTHS, POSTER_SIZES, WIDE_SIZES, cardFrame, cardLift, cardPlay, display, motion,
} from "./play-theme";
import { PremiumBadge } from "./play-ui";

/**
 * Cartes cinéma de Rivendy Play (« Emerald Cinema », 2026-10-24) : l'image
 * domine, un fondu noir en bas porte le type, le titre et la durée ; au
 * survol, la carte grandit à peine et son bord s'allume en vert. Images :
 * seulement les VRAIES images du catalogue (affiche cadrée sur son haut, où
 * sont les visages ; vignette paysage d'un clip), redimensionnées sans
 * recadrage par Supabase et chargées à l'approche. Les commandes (lecture,
 * « Ma liste », retirer) sont posées sur l'image, jamais dans le lien de la
 * carte : les toucher n'ouvre pas la fiche.
 */

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

/** Sans image : la salle sombre, un halo et une claquette (jamais une image inventée). */
export function ArtFallback({ wide }: { wide?: boolean }) {
  return (
    <span aria-hidden className="absolute inset-0 grid place-items-center bg-gradient-to-br from-rvp-raised via-rvp-surface to-rvp-ground">
      <span className="rvp-hero-glow absolute inset-0" />
      <Clapperboard className={cn("relative text-rvp-accent/60", wide ? "h-9 w-9" : "h-8 w-8")} />
    </span>
  );
}

/** Barre d'avancement : piste discrète, part vue en vert lumineux, remplie à l'apparition. */
export function ProgressTrack({ ratio, className }: { ratio: number; className?: string }) {
  const pct = Math.max(2, Math.min(100, Math.round(ratio * 100)));
  return (
    <span role="presentation" className={cn("block h-1 overflow-hidden rounded-full bg-white/20", className)}>
      <span className="rvp-grow block h-full rounded-full bg-gradient-to-r from-rvp-accent to-rvp-cinema shadow-rvp-dot" style={{ width: `${pct}%` }} />
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
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
        motion,
        tone === "overlay" && "rvp-reveal backdrop-blur-md",
        on ? "border-rvp-accent bg-rvp-accent text-rvp-on-accent shadow-rvp-cta"
          : tone === "overlay" ? "border-white/30 bg-rvp-ground/55 text-white hover:border-white/70 hover:bg-rvp-ground/75"
            : "border-rvp-edge text-rvp-soft hover:border-rvp-edge-strong hover:text-rvp-accent",
        className,
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
        : on ? <Check className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
    </button>
  );
}

/** Retirer une carte (Continuer à regarder, En cours) : même place que « Ma liste ». */
function RemoveButton({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button type="button" onClick={onRemove} aria-label={label} title={label}
      className={cn("rvp-reveal absolute right-2.5 top-2.5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-rvp-ground/55 text-white backdrop-blur-md hover:border-white/70 hover:bg-rvp-ground/75", motion)}>
      <X className="h-4 w-4" aria-hidden />
    </button>
  );
}

/** Lecture directe : le film ou le clip ; pour une série, ses épisodes. */
function playTarget(title: PlayTitle): { href: string; label: string } {
  const watch = watchHref(title);
  return watch
    ? { href: watch, label: `Regarder « ${title.title} »` }
    : { href: `${titlePath(title)}#episodes`, label: `Voir les épisodes de « ${title.title} »` };
}

/**
 * Carte cinéma 4:3 (À l'affiche, Films, Séries, Ma liste, recherche) :
 * l'image remplit la carte, type, titre, année et durée posés dessus, bouton
 * de lecture en bas à droite. `href` : une autre cible que la fiche. La carte
 * se règle sur SA largeur (@container) : étroite (deux colonnes sur
 * téléphone), elle garde le titre et la durée, en plus petit.
 */
export function MediaCard({ title, href, kicker, meta, progress, onRemove, removeLabel, eager, sizes = CARD_SIZES }: {
  title: PlayTitle; href?: string; kicker?: string; meta?: string; progress?: number | null;
  onRemove?: () => void; removeLabel?: string; eager?: boolean; sizes?: string;
}) {
  const poster = posterArt(title);
  const art = poster ?? landscapeArt(title);
  const top = kicker ?? tileKicker(title);
  const bottom = meta ?? tileMeta(title);
  const play = playTarget(title);
  const seen = progress != null && progress > 0;
  const corner = "h-9 w-9 @min-[13rem]:h-10 @min-[13rem]:w-10";
  return (
    <article className={cn("rvp-card group @container relative", cardLift)}>
      <Link href={href ?? titlePath(title)} className={cn(cardFrame, "aspect-[4/3]")}>
        <PlayImg src={art} widths={CARD_WIDTHS} sizes={sizes} eager={eager}
          className={cn("absolute inset-0 h-full w-full object-cover", poster ? "object-[50%_18%]" : "object-[50%_35%]")}
          fallback={<ArtFallback />} />
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-rvp-ground via-rvp-ground/45 via-35% to-transparent to-70%" />
        {title.is_premium && kindOf(title.kind) !== "clip" ? <span className="absolute left-2.5 top-2.5 @min-[13rem]:left-3 @min-[13rem]:top-3"><PremiumBadge solid /></span> : null}
        <span className="absolute inset-x-0 bottom-0 pb-3 pl-3 pr-12 pt-6 @min-[13rem]:pb-4 @min-[13rem]:pl-4 @min-[13rem]:pr-16">
          {top ? <span className="hidden truncate text-[11.5px] font-medium text-rvp-soft @min-[13rem]:block">{top}</span> : null}
          <span className={cn(display, "mt-0.5 line-clamp-2 text-[15px] leading-[1.1] text-rvp-text @min-[13rem]:text-[17px] @min-[16rem]:text-[19px]")}>{title.title}</span>
          {bottom ? <span className="mt-1 block truncate text-[11.5px] text-rvp-muted @min-[13rem]:text-[12px]">{bottom}</span> : null}
        </span>
        {seen ? <ProgressTrack ratio={progress} className="absolute inset-x-0 bottom-0 rounded-none" /> : null}
      </Link>
      <Link href={play.href} aria-label={play.label} title={play.label}
        className={cn(cardPlay, corner, "absolute bottom-2.5 right-2.5 @min-[13rem]:bottom-4 @min-[13rem]:right-4")}>
        <Play className="h-4 w-4 translate-x-px fill-current" aria-hidden />
      </Link>
      {onRemove ? (
        <RemoveButton label={removeLabel ?? `Retirer « ${title.title} »`} onRemove={onRemove} />
      ) : (
        <ListToggle titleId={title.id} label={title.title} className={cn(corner, "absolute right-2.5 top-2.5 z-10")} />
      )}
    </article>
  );
}

/**
 * « Continuer à regarder » (16:9) : toute la carte reprend la lecture à la
 * position enregistrée ; type ou épisode, titre, temps restant et barre
 * d'avancement à gauche, bouton de lecture à droite.
 */
export function ResumeCard({ title, href, kicker, remaining, ratio, onRemove, removeLabel }: {
  title: PlayTitle; href: string; kicker: string; remaining: string; ratio: number | null; onRemove: () => void; removeLabel: string;
}) {
  const poster = posterArt(title);
  const art = landscapeArt(title) ?? poster;
  return (
    <article className={cn("rvp-card group relative", cardLift)}>
      <Link href={href} className={cn(cardFrame, "aspect-video")}>
        <PlayImg src={art} widths={CARD_WIDTHS} sizes={WIDE_SIZES}
          className={cn("absolute inset-0 h-full w-full object-cover", landscapeArt(title) ? "object-[50%_35%]" : "object-[50%_22%]")}
          fallback={<ArtFallback wide />} />
        <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-rvp-ground/90 via-rvp-ground/40 to-transparent" />
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-rvp-ground/90 to-transparent to-60%" />
        <span className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4">
          <span className="min-w-0 flex-1">
            <span className="sr-only">Reprendre : </span>
            <span className="block truncate text-[11.5px] font-medium text-rvp-soft">{kicker}</span>
            <span className={cn(display, "mt-0.5 block truncate text-[19px] leading-tight text-rvp-text")}>{title.title}</span>
            <span className="mt-1 block text-[12px] text-rvp-muted">{remaining}</span>
            {ratio != null && ratio > 0 ? <ProgressTrack ratio={ratio} className="mt-2.5 max-w-[14rem]" /> : null}
          </span>
          <span aria-hidden className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rvp-accent text-rvp-on-accent shadow-rvp-cta group-hover:bg-rvp-accent-hover group-hover:shadow-rvp-cta-hover", motion)}>
            <Play className="h-[18px] w-[18px] translate-x-px fill-current" />
          </span>
        </span>
      </Link>
      <RemoveButton label={removeLabel} onRemove={onRemove} />
    </article>
  );
}

/**
 * Clip (16:9, sa vraie vignette paysage) : l'identité de la Musique — pastille
 * « Clip » à note de musique, l'artiste sous le titre —, lecture directe.
 */
export function ClipCard({ title, eager, sizes = WIDE_SIZES }: { title: PlayTitle; eager?: boolean; sizes?: string }) {
  const wide = landscapeArt(title);
  const art = wide ?? posterArt(title);
  const meta = [title.artist?.trim(), durationLabel(title.duration_seconds)].filter(Boolean).join(" · ");
  const play = playTarget(title);
  return (
    <article className={cn("rvp-card group relative", cardLift)}>
      <Link href={titlePath(title)} className={cn(cardFrame, "aspect-video")}>
        <PlayImg src={art} widths={CARD_WIDTHS} sizes={sizes} eager={eager}
          className={cn("absolute inset-0 h-full w-full object-cover", wide ? "object-[50%_35%]" : "object-[50%_22%]")}
          fallback={<ArtFallback wide />} />
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-rvp-ground via-rvp-ground/30 via-40% to-transparent to-70%" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-rvp-ground/60 px-2.5 py-1 text-[11px] font-semibold text-rvp-text backdrop-blur-md">
          <Music className="h-3 w-3 text-rvp-accent" aria-hidden /> Clip
        </span>
        <span className="absolute inset-x-0 bottom-0 pb-3.5 pl-4 pr-16 pt-6">
          <span className={cn(display, "line-clamp-1 text-[18px] leading-tight text-rvp-text")}>{title.title}</span>
          {meta ? <span className="mt-1 block truncate text-[12.5px] text-rvp-soft">{meta}</span> : null}
        </span>
      </Link>
      <Link href={play.href} aria-label={play.label} title={play.label} className={cn(cardPlay, "absolute bottom-3.5 right-3.5")}>
        <Play className="h-4 w-4 translate-x-px fill-current" aria-hidden />
      </Link>
      <ListToggle titleId={title.id} label={title.title} className="absolute right-2.5 top-2.5 z-10" />
    </article>
  );
}

/** Ligne sous une affiche : l'artiste d'un clip, sinon « 2023 · Action · 14 min » (« Film » va de soi). */
function posterMeta(title: PlayTitle): string {
  if (kindOf(title.kind) === "clip" && title.artist) return title.artist;
  return metaParts(title).filter((p) => !(kindOf(title.kind) === "film" && p === "Film")).join(" · ");
}

/** Affiche portrait 2:3 entière (classement d'un grand catalogue : le rang en grand). */
export function PosterCard({ title, rank, progress, sizes = POSTER_SIZES, eager }: {
  title: PlayTitle; rank?: number; progress?: number | null; sizes?: string; eager?: boolean;
}) {
  const meta = posterMeta(title);
  return (
    <article className={cn("rvp-card group relative", cardLift)}>
      <Link href={titlePath(title)} className="block rounded-rvp-card">
        <span className={cn(cardFrame, "aspect-[2/3]")}>
          <PlayImg src={posterArt(title)} widths={[160, 320, 480, 720]} sizes={sizes} eager={eager}
            className="absolute inset-0 h-full w-full object-cover" fallback={<ArtFallback />} />
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-rvp-ground/85 to-transparent" />
          {rank ? (
            <span aria-hidden className={cn(display, "absolute bottom-1 left-2 text-[64px] leading-none text-rvp-text drop-shadow-[0_3px_10px_rgba(0,0,0,0.85)]")}>
              {rank}
            </span>
          ) : null}
          {title.is_premium && kindOf(title.kind) !== "clip" ? <span className="absolute left-2 top-2"><PremiumBadge solid /></span> : null}
          {progress != null && progress > 0 ? <ProgressTrack ratio={progress} className="absolute inset-x-0 bottom-0 rounded-none" /> : null}
        </span>
        <span className={cn("mt-2.5 block truncate text-sm font-semibold text-rvp-text group-hover:text-rvp-accent", motion)}>
          {rank ? <span className="sr-only">N° {rank} : </span> : null}{title.title}
        </span>
        <span className="block truncate text-xs text-rvp-muted">{meta || kindLabel(title.kind)}</span>
      </Link>
      <ListToggle titleId={title.id} label={title.title} className="absolute right-2 top-2 z-10" />
    </article>
  );
}
