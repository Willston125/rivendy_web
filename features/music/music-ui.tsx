"use client";

import {
  useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookmarkCheck, ChevronLeft, ChevronRight, Disc3, Ellipsis, Heart, ListEnd, ListPlus, ListStart, LoaderCircle, Lock,
  Music2, Pause, Play, Plus, Share2, UserRound, WifiOff, type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useDialogs } from "@/features/ui/dialogs";
import { cn } from "@/lib/utils/cn";
import { fetchRelease, isReleaseSaved, setReleaseSaved, type MusicArtist } from "./music-api";
import { MUSIC_LIBRARY_EVENT, useMusicLibrary, type LibraryEventDetail } from "./music-library";
import {
  artistName, formatDuration, isPlayable, releaseKindLabel, thumbUrl, trackSubtitle,
  type MusicRelease, type MusicTrack,
} from "./music-logic";
import { useMusicPlayer, type QueueItem } from "./player/music-player-provider";

/**
 * Briques visuelles de Rivendy Musique (refonte du 2026-10-22, d'après la
 * maquette « Rivendy Musique Studio ») : fond nuit, vert Rivendy pour tout ce
 * qui se joue ou se choisit, or réservé à la marque « Premium ». Les couleurs
 * viennent des jetons `rvm-*` (app/site.css), jamais d'un code écrit ici.
 */

export { playlistMessage } from "./music-library";

// ── Chargement d'une page ──────────────────────────────────────────────────

/**
 * Charge une donnée pour une clé (null = rien à charger) : `loading`, `error`
 * (panne réseau ou serveur, jamais confondue avec « vide ») et `reload`.
 */
export function useLoad<T>(key: string | null, load: () => Promise<T>) {
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{ key: string | null; nonce: number; data: T | null; error: boolean }>(
    { key: null, nonce: -1, data: null, error: false },
  );
  useEffect(() => {
    if (key === null) return;
    let alive = true;
    loadRef.current()
      .then((data) => { if (alive) setState({ key, nonce, data, error: false }); })
      .catch(() => { if (alive) setState({ key, nonce, data: null, error: true }); });
    return () => { alive = false; };
  }, [key, nonce]);
  const fresh = state.key === key && state.nonce === nonce;
  return {
    data: fresh ? state.data : null,
    error: fresh && state.error,
    loading: key !== null && !fresh,
    reload: () => setNonce((n) => n + 1),
  };
}

/** Lectures du navigateur : réduire les animations ? */
function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// ── Pochettes, étiquettes ──────────────────────────────────────────────────

export function Cover({ url, size, alt, className, rounded = "rounded-xl", priority = false }: {
  url: string | null | undefined; size: 160 | 320 | 480 | 720; alt: string; className?: string; rounded?: string; priority?: boolean;
}) {
  const src = thumbUrl(url, size);
  return <CoverImage key={src ?? "none"} src={src} size={size} alt={alt} className={className} rounded={rounded} priority={priority} />;
}

function CoverImage({ src, size, alt, className, rounded, priority }: {
  src: string | null; size: number; alt: string; className?: string; rounded: string; priority: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || !src.startsWith("https://") || failed) {
    return (
      <div role={alt ? "img" : undefined} aria-label={alt || undefined}
        className={cn("flex aspect-square items-center justify-center bg-gradient-to-br from-rvm-raised to-rvm-surface text-rvm-muted", rounded, className)}>
        <Music2 className="h-1/3 w-1/3" aria-hidden />
      </div>
    );
  }
  return (
    <Image src={src} alt={alt} width={size} height={size} unoptimized priority={priority}
      onError={() => setFailed(true)}
      className={cn("aspect-square bg-rvm-raised object-cover", rounded, className)} />
  );
}

export function PremiumTag({ className }: { className?: string }) {
  return (
    <span className={cn("rounded bg-rvm-premium px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#1A1206]", className)}>
      Premium
    </span>
  );
}

export function ExplicitTag() {
  return <span title="Paroles explicites" className="ml-1.5 inline-flex h-4 items-center rounded-sm bg-white/20 px-1 align-middle text-[10px] font-bold text-rvm-text">E</span>;
}

/** Égaliseur du titre en cours (immobile si les animations sont réduites). */
export function Equalizer({ paused = false, className }: { paused?: boolean; className?: string }) {
  return (
    <span aria-hidden data-paused={paused ? "true" : "false"} className={cn("rvm-eq inline-flex h-3.5 items-end gap-[2px]", className)}>
      <span className="h-full" /><span className="h-full" /><span className="h-full" />
    </span>
  );
}

// ── Mise en page ───────────────────────────────────────────────────────────

/** En-tête d'une page de la Musique. */
export function PageTitle({ title, subtitle, aside }: { title: string; subtitle?: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-black tracking-tight text-rvm-text sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-rvm-muted">{subtitle}</p> : null}
      </div>
      {aside}
    </div>
  );
}

export function Section({ title, subtitle, href, hrefLabel = "Tout voir", children, className }: {
  title: string; subtitle?: string; href?: string; hrefLabel?: string; children: ReactNode; className?: string;
}) {
  return (
    <section className={cn("mt-8", className)}>
      <div className="mb-3.5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-rvm-text sm:text-xl">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-rvm-muted">{subtitle}</p> : null}
        </div>
        {href ? (
          <Link href={href} className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1.5 text-sm font-semibold text-rvm-soft hover:text-rvm-accent">
            {hrefLabel} <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Rangée défilante de cartes : leur nombre suit la largeur (2 et un peu sur
 * téléphone, 6 sur grand écran), flèches au survol, défilement au doigt.
 */
export function CardRow({ label, children }: { label: string; children: ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    update();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update, children.length]);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: reducedMotion() ? "auto" : "smooth" });
  };
  const arrow = "absolute top-[38%] z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-rvm-line bg-rvm-panel/95 text-rvm-text shadow-xl transition hover:bg-rvm-raised sm:flex";
  return (
    <div className="group/row relative">
      <div ref={ref} onScroll={update} role="list" aria-label={label}
        className="no-scrollbar -mx-1 grid snap-x snap-mandatory auto-cols-[44%] grid-flow-col gap-4 overflow-x-auto px-1 pb-2 sm:auto-cols-[30%] md:auto-cols-[23%] xl:auto-cols-[18.4%] 2xl:auto-cols-[15.3%]">
        {children.map((child, i) => <div key={i} role="listitem" className="min-w-0 snap-start">{child}</div>)}
      </div>
      {!edges.start ? (
        <button type="button" onClick={() => scroll(-1)} aria-label={`${label} : précédents`} className={cn(arrow, "-left-3")}>
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
      ) : null}
      {!edges.end ? (
        <button type="button" onClick={() => scroll(1)} aria-label={`${label} : suivants`} className={cn(arrow, "-right-3")}>
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function CardRowSkeleton({ count = 6, round = false }: { count?: number; round?: boolean }) {
  return (
    <div aria-hidden className="grid auto-cols-[44%] grid-flow-col gap-4 overflow-hidden sm:auto-cols-[30%] md:auto-cols-[23%] xl:auto-cols-[18.4%] 2xl:auto-cols-[15.3%]">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className={cn("aspect-square bg-rvm-raised motion-safe:animate-pulse", round ? "rounded-full" : "rounded-xl")} />
          <div className="mt-3 h-3 w-3/4 rounded bg-rvm-raised motion-safe:animate-pulse" />
          <div className="mt-2 h-3 w-1/2 rounded bg-rvm-raised/70 motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-1.5">
          <div className="h-10 w-10 rounded-md bg-rvm-raised motion-safe:animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-rvm-raised motion-safe:animate-pulse" />
            <div className="h-3 w-1/5 rounded bg-rvm-raised/70 motion-safe:animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Disc3, title, text, action }: {
  icon?: LucideIcon; title: string; text?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-rvm-line px-6 py-10 text-center">
      <Icon className="h-10 w-10 text-rvm-muted" aria-hidden />
      <p className="mt-3 font-semibold text-rvm-text">{title}</p>
      {text ? <p className="mt-1 max-w-md text-sm text-rvm-muted">{text}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Panne de chargement : on le dit, et on propose de réessayer. */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-rvm-line bg-rvm-surface px-6 py-10 text-center">
      <WifiOff className="h-10 w-10 text-rvm-muted" aria-hidden />
      <p className="mt-3 font-semibold text-rvm-text">Impossible de charger la musique</p>
      <p className="mt-1 text-sm text-rvm-muted">Vérifiez votre connexion, puis réessayez.</p>
      <button type="button" onClick={onRetry}
        className="mt-4 h-10 rounded-full border border-rvm-line px-5 text-sm font-semibold text-rvm-text hover:border-rvm-accent hover:text-rvm-accent">
        Réessayer
      </button>
    </div>
  );
}

// ── Boutons ────────────────────────────────────────────────────────────────

export const primaryButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-rvm-accent px-5 text-sm font-bold text-rvm-on-accent shadow-lg shadow-rvm-accent/20 transition hover:bg-rvm-accent-hover active:bg-rvm-accent-pressed disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none";
export const secondaryButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/20 px-5 text-sm font-semibold text-rvm-text transition hover:border-rvm-accent hover:text-rvm-accent disabled:cursor-not-allowed disabled:opacity-40";
export const iconButton =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-rvm-muted transition hover:bg-white/10 hover:text-rvm-text disabled:cursor-not-allowed disabled:opacity-30";

/**
 * « Écouter » d'une page (sortie, playlist, favoris…) : si cette liste joue
 * déjà, le même bouton met en pause et reprend.
 */
export function PlayAllButton({ items, label = "Écouter", className }: { items: QueueItem[]; label?: string; className?: string }) {
  const player = useMusicPlayer();
  const playable = items.filter((x) => isPlayable(x.track));
  const curId = player.current?.track.id;
  const isThis = !!curId && items.some((x) => x.track.id === curId);
  return (
    <button type="button" disabled={playable.length === 0}
      onClick={() => (isThis ? player.toggle() : player.playQueue(items, 0))}
      className={cn(primaryButton, className)}>
      {isThis && player.playing ? <Pause className="h-4 w-4 fill-current" aria-hidden /> : <Play className="h-4 w-4 fill-current" aria-hidden />}
      {isThis ? (player.playing ? "Pause" : "Reprendre") : label}
    </button>
  );
}

/** Lire une sortie dont on n'a que la fiche : ses titres sont chargés au clic. */
function useReleasePlay(release: MusicRelease) {
  const player = useMusicPlayer();
  const [busy, setBusy] = useState(false);
  const isThis = player.current?.release.id === release.id;
  async function play() {
    if (isThis) { player.toggle(); return; }
    setBusy(true);
    try {
      const { release: r, tracks } = await fetchRelease(release.id);
      player.playQueue(toQueue(tracks, r ?? release), 0);
    } catch {
      // Panne réseau : le lecteur dit « aucun titre disponible ».
      player.playQueue([], 0);
    } finally {
      setBusy(false);
    }
  }
  return { isThis, busy, playing: isThis && player.playing, play };
}

/** « Écouter » d'une sortie mise en avant (bannière). */
export function PlayReleaseLabelButton({ release, label = "Écouter" }: { release: MusicRelease; label?: string }) {
  const { isThis, busy, playing, play } = useReleasePlay(release);
  return (
    <button type="button" onClick={play} className={primaryButton}>
      {busy ? <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
        : playing ? <Pause className="h-4 w-4 fill-current" aria-hidden /> : <Play className="h-4 w-4 fill-current" aria-hidden />}
      {isThis ? (playing ? "Pause" : "Reprendre") : label}
    </button>
  );
}

/** « Enregistrer » une sortie dans la bibliothèque du compte (site et app). */
export function SaveReleaseButton({ release, className }: { release: MusicRelease; className?: string }) {
  const { user } = useAuth();
  const library = useMusicLibrary();
  const dialogs = useDialogs();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!user) { setSaved(false); return; }
    let alive = true;
    void isReleaseSaved(release.id).then((v) => { if (alive) setSaved(v); }).catch(() => {});
    return () => { alive = false; };
  }, [user, release.id]);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<LibraryEventDetail>).detail;
      if (d?.kind === "save" && d.id === release.id) setSaved(d.on);
    };
    window.addEventListener(MUSIC_LIBRARY_EVENT, on);
    return () => window.removeEventListener(MUSIC_LIBRARY_EVENT, on);
  }, [release.id]);

  async function toggle() {
    if (!user) { library.requireLogin({ kind: "save", id: release.id, label: release.title }); return; }
    const next = !saved;
    setSaved(next);
    const ok = await setReleaseSaved(release.id, next);
    if (!ok) { setSaved(!next); dialogs.notify("Action impossible pour l’instant. Réessayez.", "error"); return; }
    dialogs.notify(next ? "Enregistré dans votre bibliothèque" : "Retiré de votre bibliothèque", next ? "success" : "info");
  }

  return (
    <button type="button" onClick={toggle} aria-pressed={saved}
      className={cn(secondaryButton, saved && "border-rvm-accent text-rvm-accent", className)}>
      {saved ? <BookmarkCheck className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
      {saved ? "Enregistré" : "Enregistrer"}
    </button>
  );
}

/** Bouton rond de lecture posé sur une pochette : charge la sortie et la joue. */
export function PlayReleaseButton({ release, className }: { release: MusicRelease; className?: string }) {
  const { isThis, busy, play } = useReleasePlay(release);
  const player = useMusicPlayer();
  return (
    <button type="button" onClick={play} aria-label={isThis && player.playing ? `Mettre en pause ${release.title}` : `Écouter ${release.title}`}
      className={cn("flex h-11 w-11 items-center justify-center rounded-full bg-rvm-accent text-rvm-on-accent shadow-xl shadow-black/40 transition hover:scale-105 hover:bg-rvm-accent-hover active:bg-rvm-accent-pressed motion-reduce:transition-none motion-reduce:hover:scale-100", className)}>
      {busy ? <LoaderCircle className="h-5 w-5 motion-safe:animate-spin" aria-hidden />
        : isThis && player.playing ? <Pause className="h-5 w-5 fill-current" aria-hidden />
        : <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden />}
    </button>
  );
}

export function LikeButton({ track, className, size = "h-5 w-5" }: { track: { id: string; title: string }; className?: string; size?: string }) {
  const library = useMusicLibrary();
  const { ensureLikes } = library;
  useEffect(() => { ensureLikes([track.id]); }, [ensureLikes, track.id]);
  const liked = library.isLiked(track.id);
  return (
    <button type="button" onClick={() => void library.toggleLike(track)} aria-pressed={liked}
      aria-label={liked ? `Retirer « ${track.title} » de vos favoris` : `Ajouter « ${track.title} » à vos favoris`}
      className={cn(iconButton, liked && "text-rvm-accent hover:text-rvm-accent", className)}>
      <Heart className={cn(size, liked && "fill-current")} aria-hidden />
    </button>
  );
}

// ── Cartes ─────────────────────────────────────────────────────────────────

export function ReleaseCard({ release, priority = false }: { release: MusicRelease; priority?: boolean }) {
  const player = useMusicPlayer();
  const isThis = player.current?.release.id === release.id;
  return (
    <div className="group relative min-w-0">
      <Link href={`/music/album/${release.id}`} className="block rounded-xl">
        <div className={cn("relative overflow-hidden rounded-xl shadow-lg shadow-black/30 ring-1 ring-white/5", isThis && "ring-2 ring-rvm-accent")}>
          <Cover url={release.cover_url} size={320} alt="" rounded="rounded-xl" priority={priority}
            className="w-full transition duration-300 motion-safe:group-hover:scale-[1.03]" />
          {release.is_premium ? <PremiumTag className="absolute left-2 top-2" /> : null}
        </div>
        <p className={cn("mt-2.5 truncate text-[15px] font-semibold", isThis ? "text-rvm-accent" : "text-rvm-text")}>{release.title}</p>
        <p className="truncate text-[13px] text-rvm-soft">{artistName(release)} · {releaseKindLabel(release.kind)}</p>
      </Link>
      <div className="pointer-events-none absolute inset-x-0 top-0 aspect-square">
        <PlayReleaseButton release={release}
          className={cn("pointer-events-auto absolute bottom-2.5 right-2.5",
            isThis ? "opacity-100" : "opacity-100 sm:translate-y-1 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:group-focus-within:translate-y-0 sm:group-focus-within:opacity-100")} />
      </div>
    </div>
  );
}

/**
 * Sortie en tuile large (petit catalogue) : pochette nette, titre, artiste,
 * type et année, lecture directe. Remplit la largeur sans grand vide.
 */
export function ReleaseTile({ release }: { release: MusicRelease }) {
  const player = useMusicPlayer();
  const isThis = player.current?.release.id === release.id;
  const year = release.release_date?.slice(0, 4) || release.published_at?.slice(0, 4) || "";
  return (
    <div className={cn("group relative flex items-center gap-4 rounded-2xl border bg-rvm-surface p-3 transition-colors hover:bg-rvm-raised",
      isThis ? "border-rvm-accent/70" : "border-rvm-line")}>
      <Link href={`/music/album/${release.id}`} className="relative shrink-0" tabIndex={-1} aria-hidden>
        <Cover url={release.cover_url} size={320} alt="" className="h-24 w-24 shadow-lg shadow-black/40 sm:h-28 sm:w-28" rounded="rounded-xl" />
        {release.is_premium ? <PremiumTag className="absolute left-1.5 top-1.5" /> : null}
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/music/album/${release.id}`}
          className={cn("block truncate text-base font-bold after:absolute after:inset-0 after:rounded-2xl", isThis ? "text-rvm-accent" : "text-rvm-text")}>
          {release.title}
        </Link>
        <p className="mt-0.5 truncate text-sm text-rvm-soft">{artistName(release)}</p>
        <p className="mt-0.5 truncate text-[13px] text-rvm-muted">{releaseKindLabel(release.kind)}{year ? ` · ${year}` : ""}</p>
      </div>
      <PlayReleaseButton release={release} className="relative z-10 shrink-0" />
    </div>
  );
}

/**
 * Étagère de sorties qui suit le catalogue : jusqu'à 3 sorties, des tuiles
 * larges (pas de rangée à moitié vide) ; au-delà, une rangée défilante.
 */
export function ReleaseShelf({ releases, label }: { releases: MusicRelease[]; label: string }) {
  if (releases.length <= 3) {
    return (
      <div role="list" aria-label={label}
        className={cn("grid gap-3", releases.length === 1 ? "max-w-2xl" : releases.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3")}>
        {releases.map((r) => <div key={r.id} role="listitem" className="min-w-0"><ReleaseTile release={r} /></div>)}
      </div>
    );
  }
  return <CardRow label={label}>{releases.map((r, i) => <ReleaseCard key={r.id} release={r} priority={i < 2} />)}</CardRow>;
}

/** Artistes en liste compacte (colonne secondaire) : avatar ou initiale, nom, genre. */
export function ArtistList({ artists }: { artists: MusicArtist[] }) {
  return (
    <ul className="divide-y divide-rvm-line overflow-hidden rounded-2xl border border-rvm-line bg-rvm-surface">
      {artists.map((a) => (
        <li key={a.id}>
          <Link href={`/artist/${a.id}`} className="group flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-rvm-raised">
            {a.avatar_url ? (
              <Cover url={a.avatar_url} size={160} alt="" className="h-11 w-11 shrink-0" rounded="rounded-full" />
            ) : (
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rvm-brand/45 to-rvm-raised text-base font-black text-rvm-text">
                {a.name.trim().charAt(0).toUpperCase() || "?"}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-rvm-text group-hover:text-rvm-accent">{a.name}</span>
              <span className="block truncate text-[13px] text-rvm-soft">{a.genre || "Artiste"}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-rvm-muted" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ReleaseGrid({ releases, empty = "Rien pour l’instant." }: { releases: MusicRelease[]; empty?: string }) {
  if (releases.length === 0) return <p className="text-sm text-rvm-muted">{empty}</p>;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {releases.map((r) => <ReleaseCard key={r.id} release={r} />)}
    </div>
  );
}

export function ArtistCard({ artist }: { artist: MusicArtist }) {
  return (
    <Link href={`/artist/${artist.id}`} className="group block rounded-xl p-1 text-center">
      <div className="mx-auto w-full max-w-[160px] overflow-hidden rounded-full shadow-lg shadow-black/30 ring-1 ring-white/5">
        {artist.avatar_url ? (
          <Cover url={artist.avatar_url} size={320} alt="" rounded="rounded-full"
            className="w-full transition duration-300 motion-safe:group-hover:scale-[1.04]" />
        ) : (
          <div className="flex aspect-square items-center justify-center rounded-full bg-gradient-to-br from-rvm-brand/40 to-rvm-raised text-2xl font-black text-rvm-text sm:text-3xl">
            {artist.name.trim().charAt(0).toUpperCase() || <UserRound className="h-1/3 w-1/3" aria-hidden />}
          </div>
        )}
      </div>
      <p className="mt-2.5 truncate text-[15px] font-semibold text-rvm-text group-hover:text-rvm-accent">{artist.name}</p>
      <p className="truncate text-[13px] text-rvm-soft">{artist.genre || "Artiste"}</p>
    </Link>
  );
}

// ── Liste de titres ────────────────────────────────────────────────────────

export type MenuEntry = { label: string; icon: LucideIcon; onSelect: () => void; danger?: boolean };

/** Titres → éléments de file (chaque titre porte sa sortie). */
export function toQueue(tracks: MusicTrack[], release?: MusicRelease | null): QueueItem[] {
  return tracks
    .map((t) => ({ track: t, release: (release ?? t.music_releases) as MusicRelease }))
    .filter((x) => !!x.release);
}

/**
 * Liste jouable : sortie, playlist, favoris, historique, Hit, recherche.
 * Toucher le titre (ou double-cliquer la ligne) lance la liste à partir de
 * lui ; le titre en cours est en vert, avec l'égaliseur.
 */
export function TrackList({ items, showAlbum = true, showCover = true, numbered = false, ranks, menuExtra, hideRelease = false, label = "Titres", highlight = null }: {
  items: QueueItem[];
  /** Titre ouvert par un lien partagé : mis en évidence. */
  highlight?: string | null;
  showAlbum?: boolean;
  showCover?: boolean;
  /** Numéro de piste de la sortie (page d'album) au lieu du rang dans la liste. */
  numbered?: boolean;
  /** Rivendy Hit : rang et évolution par titre. */
  ranks?: Map<string, { rank: number; move: string }>;
  menuExtra?: (item: QueueItem, i: number) => MenuEntry[];
  /** Page de la sortie : pas de lien « Aller à l'album ». */
  hideRelease?: boolean;
  label?: string;
}) {
  const player = useMusicPlayer();
  const library = useMusicLibrary();
  const { ensureLikes } = library;
  const ids = items.map((x) => x.track.id).join(",");
  useEffect(() => { if (ids) ensureLikes(ids.split(",")); }, [ensureLikes, ids]);

  return (
    <div>
      <div aria-hidden className="mb-1 hidden items-center gap-3 border-b border-rvm-line px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-rvm-soft md:flex">
        <span className="w-8 text-center">#</span>
        <span className="min-w-0 flex-1">Titre</span>
        {showAlbum ? <span className="hidden w-[26%] lg:block">Album</span> : null}
        <span className="w-12 text-right">Durée</span>
        <span className="w-[5.25rem]" />
      </div>
      <ol aria-label={label}>
        {items.map((item, i) => {
          const { track: t, release: r } = item;
          const playable = isPlayable(t);
          const isCurrent = player.current?.track.id === t.id;
          const locked = !!r.is_premium && !t.is_free;
          const rank = ranks?.get(t.id);
          const play = () => { if (!playable) return; if (isCurrent) player.toggle(); else player.playQueue(items, i); };
          return (
            <li key={`${t.id}-${i}`} id={`t-${t.id}`} onDoubleClick={play}
              className={cn("group flex scroll-mt-32 items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5",
                isCurrent && "bg-rvm-accent/10 hover:bg-rvm-accent/15", highlight === t.id && "ring-1 ring-rvm-accent/70",
                !playable && "opacity-60")}>
              <div className="relative flex h-10 w-8 shrink-0 flex-col items-center justify-center">
                {isCurrent ? <Equalizer paused={!player.playing} className="group-hover:invisible group-focus-within:invisible" />
                  : rank ? (
                    <span className="flex flex-col items-center leading-none group-hover:invisible group-focus-within:invisible">
                      <span className={cn("text-sm font-black tabular-nums", rank.rank <= 3 ? "text-rvm-accent" : "text-rvm-text")}>{rank.rank}</span>
                      <span className="mt-0.5 text-[10px] text-rvm-muted">{rank.move}</span>
                    </span>
                  ) : (
                    <span className="text-sm tabular-nums text-rvm-muted group-hover:invisible group-focus-within:invisible">{numbered ? t.position : i + 1}</span>
                  )}
                <button type="button" onClick={play} disabled={!playable}
                  aria-label={isCurrent && player.playing ? `Mettre en pause ${t.title}` : `Écouter ${t.title}`}
                  className="absolute inset-0 flex items-center justify-center rounded-md text-rvm-text opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 disabled:hidden">
                  {isCurrent && player.playing ? <Pause className="h-4 w-4 fill-current" aria-hidden /> : <Play className="h-4 w-4 fill-current" aria-hidden />}
                </button>
              </div>
              {showCover ? <Cover url={r.cover_url} size={160} alt="" className="h-10 w-10 shrink-0" rounded="rounded-md" /> : null}
              <div className="min-w-0 flex-1">
                <button type="button" onClick={play} disabled={!playable} tabIndex={-1}
                  className={cn("block max-w-full truncate text-left text-[15px] font-semibold", isCurrent ? "text-rvm-accent" : "text-rvm-text")}>
                  {t.title}{t.explicit ? <ExplicitTag /> : null}
                </button>
                <span className="block truncate text-[13px] text-rvm-soft">
                  {r.artist_id ? <Link href={`/artist/${r.artist_id}`} className="hover:text-rvm-text hover:underline">{trackSubtitle(t, r)}</Link> : trackSubtitle(t, r)}
                </span>
              </div>
              {showAlbum ? (
                <span className="hidden w-[26%] min-w-0 truncate text-sm text-rvm-soft lg:block">
                  {hideRelease ? r.title : <Link href={`/music/album/${r.id}`} className="hover:text-rvm-text hover:underline">{r.title}</Link>}
                </span>
              ) : null}
              <span className="flex shrink-0 items-center gap-1.5">
                {!playable ? <span className="text-xs text-rvm-muted">Bientôt</span>
                  : locked ? <Lock className="h-3.5 w-3.5 text-rvm-premium" aria-label="Premium" />
                  : r.is_premium && t.is_free ? <span className="text-xs font-semibold text-rvm-premium">Offert</span> : null}
                <span className="hidden w-12 text-right text-[13px] tabular-nums text-rvm-soft sm:block">{formatDuration(t.duration_seconds)}</span>
              </span>
              <LikeButton track={t} size="h-[18px] w-[18px]" className="hidden sm:inline-flex" />
              <TrackMenuButton item={item} extra={menuExtra?.(item, i)} hideRelease={hideRelease} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Bouton « … » d'un titre : menu (feuille du bas sur téléphone). */
export function TrackMenuButton({ item, extra, hideRelease = false, className, onOpenPage }: {
  item: QueueItem; extra?: MenuEntry[]; hideRelease?: boolean; className?: string;
  /** Appelé avant d'ouvrir une page (le lecteur agrandi se referme). */
  onOpenPage?: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <button type="button" onClick={(e) => setAnchor(e.currentTarget)} aria-haspopup="menu" aria-expanded={!!anchor}
        aria-label={`Plus d’options pour « ${item.track.title} »`} className={cn(iconButton, className)}>
        <Ellipsis className="h-5 w-5" aria-hidden />
      </button>
      {anchor ? <TrackMenu item={item} anchor={anchor} extra={extra} hideRelease={hideRelease} onOpenPage={onOpenPage}
        onClose={() => { anchor.focus(); setAnchor(null); }} /> : null}
    </>
  );
}

function TrackMenu({ item, anchor, extra = [], hideRelease, onClose, onOpenPage }: {
  item: QueueItem; anchor: HTMLElement | null; extra?: MenuEntry[]; hideRelease: boolean; onClose: () => void; onOpenPage?: () => void;
}) {
  const player = useMusicPlayer();
  const library = useMusicLibrary();
  const router = useRouter();
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [sheet, setSheet] = useState(false);
  const { track: t, release: r } = item;
  const playable = isPlayable(t);
  const liked = library.isLiked(t.id);

  const go = (href: string) => { onOpenPage?.(); router.push(href); };
  const entries: MenuEntry[] = [
    ...(playable ? [
      { label: "Lire ensuite", icon: ListStart, onSelect: () => player.playNext(item) },
      { label: "Ajouter à la file d’attente", icon: ListEnd, onSelect: () => player.addToQueue(item) },
    ] : []),
    { label: "Ajouter à une playlist", icon: ListPlus, onSelect: () => library.pickPlaylist(item) },
    { label: liked ? "Retirer de vos favoris" : "Ajouter à vos favoris", icon: Heart, onSelect: () => void library.toggleLike(t) },
    ...(!hideRelease ? [{ label: "Aller à l’album", icon: Disc3, onSelect: () => go(`/music/album/${r.id}?t=${t.id}`) }] : []),
    ...(r.artist_id ? [{ label: "Aller à l’artiste", icon: UserRound, onSelect: () => go(`/artist/${r.artist_id}`) }] : []),
    { label: "Partager", icon: Share2, onSelect: () => void library.share("track", t.id, `${t.title} — ${artistName(r)}`) },
    ...extra,
  ];

  useLayoutEffect(() => {
    const narrow = window.innerWidth < 640;
    setSheet(narrow);
    const el = menu.current;
    if (narrow || !anchor || !el) return;
    const a = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.max(8, Math.min(a.right - w, window.innerWidth - w - 8));
    // Le lecteur fixe occupe le bas : on ouvre au-dessus s'il manque la place.
    const below = a.bottom + 6;
    const top = below + h > window.innerHeight - 96 ? Math.max(8, a.top - h - 6) : below;
    setPos({ left, top });
  }, [anchor]);

  // Le parent se redessine pendant la lecture : la fermeture passe par une
  // référence, pour ne pas reprendre le focus à chaque fois.
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const list = Array.from(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
      const i = list.indexOf(document.activeElement as HTMLElement);
      list[(i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length]?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return createPortal(
    <div className="rvm-scope fixed inset-0 z-[65]" onClick={onClose}>
      {sheet ? <div className="absolute inset-0 bg-black/50" aria-hidden /> : null}
      <div ref={menu} role="menu" aria-label={`Options pour « ${t.title} »`} onClick={(e) => e.stopPropagation()}
        style={sheet ? undefined : { left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
        className={cn("border border-rvm-line bg-rvm-raised text-rvm-text shadow-2xl",
          sheet ? "absolute inset-x-0 bottom-0 rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
            : "absolute w-64 rounded-xl py-1.5")}>
        {sheet ? (
          <div className="flex items-center gap-3 border-b border-rvm-line px-4 pb-3 pt-2">
            <Cover url={r.cover_url} size={160} alt="" className="h-12 w-12 shrink-0" rounded="rounded-md" />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{t.title}</span>
              <span className="block truncate text-sm text-rvm-muted">{artistName(r)}</span>
            </span>
          </div>
        ) : null}
        {entries.map((e) => (
          <button key={e.label} type="button" role="menuitem" tabIndex={-1}
            onClick={() => { onClose(); e.onSelect(); }}
            className={cn("flex w-full items-center gap-3 text-left text-sm hover:bg-white/10 focus:bg-white/10 focus:outline-none",
              sheet ? "min-h-12 px-5 text-base" : "min-h-11 px-3.5", e.danger ? "text-red-300" : "text-rvm-text")}>
            <e.icon className={cn("h-[18px] w-[18px] shrink-0", e.danger ? "text-red-300" : "text-rvm-muted")} aria-hidden />
            {e.label}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
