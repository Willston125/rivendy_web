"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Bookmark, BookmarkCheck, EllipsisVertical, Music, Share2, UserRound } from "lucide-react";
import { useDialogs } from "@/features/ui/dialogs";
import { cn } from "@/lib/utils/cn";
import { PlayImg } from "../play-cards";
import { landscapeArt, posterArt, streamThumbnail, type PlayTitle } from "../play-logic";
import { usePlayList } from "../play-list";
import { motion } from "../play-theme";
import {
  artistInitials, clipArtistName, clipMeta, clipPath, clockLabel, isNewClip, type ClipArtist, type ClipCounts,
} from "./clips-logic";

/**
 * Cartes de Rivendy Clips (refonte du 2026-10-26) : la miniature 16:9 domine,
 * la durée en coin, puis l'avatar, le titre (deux lignes au plus), l'artiste
 * et seulement les chiffres qui existent. La miniature et le titre lancent la
 * lecture ; l'avatar et le nom ouvrent la page de l'artiste. Les images se
 * chargent à l'approche ; aucune vidéo n'est téléchargée depuis la grille.
 */

/** Largeurs proposées au navigateur et place réelle des miniatures (grille de 1 à 4 colonnes). */
const THUMB_WIDTHS = [320, 480, 720] as const;
export const TILE_SIZES = "(min-width: 1536px) 22vw, (min-width: 1024px) 28vw, (min-width: 640px) 45vw, 92vw";
/** Un ou deux clips seulement : deux grandes colonnes. */
export const FEW_SIZES = "(min-width: 640px) 45vw, 92vw";
const ROW_SIZES = "176px";

/**
 * Image d'un clip : sa vignette paysage posée au dashboard, sinon l'image de
 * SA vidéo publique (clip d'artiste), sinon son affiche — jamais une image
 * inventée.
 */
export function clipArt(t: PlayTitle): { src: string | null; wide: boolean } {
  const wide = landscapeArt(t);
  if (wide) return { src: wide, wide: true };
  if (t.public_video_uid) return { src: streamThumbnail(t.public_video_uid, 360), wide: true };
  return { src: posterArt(t), wide: false };
}

function ThumbFallback() {
  return (
    <span aria-hidden className="absolute inset-0 grid place-items-center bg-gradient-to-br from-rvp-raised to-rvp-surface">
      <Music className="h-8 w-8 text-rvp-accent/60" />
    </span>
  );
}

/** Miniature 16:9 : image, durée discrète, « Nouveau » si la publication date de moins de 14 jours. */
export function ClipThumb({ clip, now, eager, sizes = TILE_SIZES, className }: {
  clip: PlayTitle; now: Date; eager?: boolean; sizes?: string; className?: string;
}) {
  const art = clipArt(clip);
  const time = clockLabel(clip.duration_seconds);
  return (
    <span className={cn("relative block aspect-video overflow-hidden rounded-rvp bg-rvp-raised", className)}>
      <PlayImg src={art.src} widths={THUMB_WIDTHS} sizes={sizes} eager={eager}
        className={cn("absolute inset-0 h-full w-full object-cover transition-transform duration-(--rvp-base) ease-rvp motion-safe:group-hover:scale-[1.03]",
          art.wide ? "object-center" : "object-[50%_20%]")}
        fallback={<ThumbFallback />} />
      {isNewClip(clip, now) ? (
        <span className="absolute left-2 top-2 rounded-md bg-rvp-accent px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-rvp-on-accent">
          Nouveau
        </span>
      ) : null}
      {time ? (
        <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[12px] font-semibold tabular-nums text-white">
          <span className="sr-only">Durée </span>{time}
        </span>
      ) : null}
    </span>
  );
}

/** Photo de l'artiste, sinon ses initiales (jamais une photo d'emprunt). */
export function ArtistAvatar({ artist, name, className }: { artist?: ClipArtist | null; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const url = artist?.avatar_url?.startsWith("https://") && !failed ? artist.avatar_url : null;
  return (
    <span className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-rvp-accent/80 to-rvp-accent-pressed font-bold text-rvp-on-accent", className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span aria-hidden className="text-[0.8em]">{artistInitials(name)}</span>
      )}
    </span>
  );
}

/** Artiste validé par Rivendy (profil `play_artists` approuvé) — l'information réelle derrière le badge. */
export function VerifiedMark({ className }: { className?: string }) {
  return (
    <span title="Artiste validé par Rivendy" className={cn("inline-flex shrink-0 text-rvp-accent", className)}>
      <BadgeCheck className="h-[15px] w-[15px]" aria-hidden />
      <span className="sr-only">, artiste validé par Rivendy</span>
    </span>
  );
}

/** Partage du lien du clip (feuille du téléphone, sinon copie). */
export async function shareClip(title: string, artist: string, url: string, notify: (m: string, t?: "info" | "success" | "error") => void) {
  const text = `« ${title} » de ${artist} sur Rivendy Clips`;
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    notify("Lien du clip copié.", "success");
  } catch {
    notify("Copie impossible : copiez l’adresse de la page.", "error");
  }
}

/** Menu « ⋮ » d'une carte : enregistrer, partager, voir l'artiste. */
function TileMenu({ clip, artist, name }: { clip: PlayTitle; artist: ClipArtist | null; name: string }) {
  const [open, setOpen] = useState(false);
  const list = usePlayList();
  const { notify } = useDialogs();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const saved = list.has(clip.id);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const item = cn("flex h-11 w-full items-center gap-3 rounded-rvp-sm px-3 text-left text-sm font-medium text-rvp-soft hover:bg-white/[0.06] hover:text-rvp-text", motion);
  return (
    <div ref={root} className="relative -mr-2 shrink-0"
      onBlur={(e) => { if (open && e.relatedTarget && !root.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <button ref={button} type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={id}
        aria-label={`Plus d’actions pour « ${clip.title} »`} onClick={() => setOpen((o) => !o)}
        className={cn("grid h-10 w-10 place-items-center rounded-full text-rvp-muted hover:bg-white/[0.06] hover:text-rvp-text", motion)}>
        <EllipsisVertical className="h-5 w-5" aria-hidden />
      </button>
      {open ? (
        <div id={id} role="menu" className="rvp-rise-in absolute right-0 top-full z-30 mt-1 w-60 rounded-rvp border border-rvp-edge bg-rvp-raised p-1.5 shadow-rvp-deep">
          <button type="button" role="menuitem" className={item} disabled={list.busy(clip.id)}
            onClick={() => { setOpen(false); void list.toggle(clip.id, clip.title); }}>
            {saved ? <BookmarkCheck className="h-4 w-4 text-rvp-accent" aria-hidden /> : <Bookmark className="h-4 w-4" aria-hidden />}
            {saved ? "Retirer des enregistrements" : "Enregistrer"}
          </button>
          <button type="button" role="menuitem" className={item}
            onClick={() => { setOpen(false); void shareClip(clip.title, name, `${window.location.origin}${clipPath(clip.id)}`, notify); }}>
            <Share2 className="h-4 w-4" aria-hidden /> Partager
          </button>
          {artist ? (
            <Link role="menuitem" href={`/artist/${artist.id}`} prefetch={false} className={item} onClick={() => setOpen(false)}>
              <UserRound className="h-4 w-4" aria-hidden /> Voir la page de {name}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Carte de la grille. */
export function ClipTile({ clip, artists, counts, now, eager, showArtist = true, sizes }: {
  clip: PlayTitle; artists: Record<string, ClipArtist>; counts?: ClipCounts; now: Date; eager?: boolean; showArtist?: boolean; sizes?: string;
}) {
  const artist = clip.artist_id ? artists[clip.artist_id] ?? null : null;
  const name = clipArtistName(clip, artists);
  const meta = clipMeta(counts?.views ?? 0, clip.published_at, now);
  const href = clipPath(clip.id);
  return (
    <article className="group relative min-w-0">
      <Link href={href} aria-label={`Regarder « ${clip.title} » de ${name}`}
        className={cn("block rounded-rvp ring-rvp-edge-strong hover:ring-2", motion)}>
        <ClipThumb clip={clip} now={now} eager={eager} sizes={sizes} />
      </Link>
      <div className="mt-3 flex gap-3">
        {showArtist ? (
          artist ? (
            <Link href={`/artist/${artist.id}`} prefetch={false} aria-label={`Page de l’artiste ${name}`} className="h-9 w-9 shrink-0 rounded-full">
              <ArtistAvatar artist={artist} name={name} className="h-9 w-9 text-[13px]" />
            </Link>
          ) : <ArtistAvatar name={name} className="h-9 w-9 text-[13px]" />
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-snug text-rvp-text">
            <Link href={href} className={cn("line-clamp-2 hover:text-rvp-accent", motion)}>{clip.title}</Link>
          </h3>
          {showArtist ? (
            <p className="mt-1 flex min-w-0 items-center gap-1 text-[13px] text-rvp-soft">
              {artist ? (
                <Link href={`/artist/${artist.id}`} prefetch={false} className={cn("truncate hover:text-rvp-text", motion)}>{name}</Link>
              ) : <span className="truncate">{name}</span>}
              {artist ? <VerifiedMark /> : null}
            </p>
          ) : null}
          {meta ? <p className="mt-0.5 truncate text-[13px] text-rvp-muted">{meta}</p> : null}
        </div>
        <TileMenu clip={clip} artist={artist} name={name} />
      </div>
    </article>
  );
}

/** Carte en ligne (« À suivre », listes du compte) : miniature à gauche, textes à droite. */
export function ClipRow({ clip, artists, counts, now, note, current }: {
  clip: PlayTitle; artists: Record<string, ClipArtist>; counts?: ClipCounts; now: Date; note?: string; current?: boolean;
}) {
  const name = clipArtistName(clip, artists);
  const meta = clipMeta(counts?.views ?? 0, clip.published_at, now);
  return (
    <Link href={clipPath(clip.id)} aria-current={current ? "true" : undefined}
      className={cn("group flex gap-3 rounded-rvp p-1.5 hover:bg-white/[0.04]", motion, current && "bg-rvp-accent/10 ring-1 ring-inset ring-rvp-edge-strong")}>
      <ClipThumb clip={clip} now={now} sizes={ROW_SIZES} className="w-40 shrink-0 sm:w-44" />
      <span className="min-w-0 flex-1 py-0.5">
        <span className="line-clamp-2 text-[14px] font-semibold leading-snug text-rvp-text group-hover:text-rvp-accent">{clip.title}</span>
        <span className="mt-1 block truncate text-[12.5px] text-rvp-soft">{name}</span>
        {meta ? <span className="block truncate text-[12.5px] text-rvp-muted">{meta}</span> : null}
        {note ? <span className="mt-1 block truncate text-[11.5px] font-semibold text-rvp-accent/90">{note}</span> : null}
      </span>
    </Link>
  );
}
