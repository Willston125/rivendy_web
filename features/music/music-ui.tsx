"use client";

import {
  useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookmarkCheck, ChevronLeft, ChevronRight, CircleCheck, CirclePlus, Clock3, Disc3, Ellipsis, Heart, ListEnd, ListPlus,
  ListStart, LoaderCircle, Lock, Music2, Pause, Play, Plus, Share2, Shuffle, UserCheck, UserPlus, UserRound, WifiOff, X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useDialogs } from "@/features/ui/dialogs";
import { cn } from "@/lib/utils/cn";
import { fetchRelease, isFollowing, isReleaseSaved, setFollowing, setReleaseSaved, type MusicArtist } from "./music-api";
import { MUSIC_LIBRARY_EVENT, emitLibraryChange, useMusicLibrary, type LibraryEventDetail } from "./music-library";
import {
  HOME_GRID, addedAtLabel, artistName, formatDuration, isPlayable, releaseKindLabel, thumbUrl, trackSubtitle,
  type MusicRelease, type MusicTrack,
} from "./music-logic";
import { useMusicPlayer, type PlaySource, type QueueItem } from "./player/music-player-provider";

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

/**
 * Champ de recherche relié à l'adresse (?q=) : ce qui est tapé part dans
 * l'adresse après une courte pause (`commit`) ; si l'adresse change
 * ailleurs (retour arrière, autre lien), le champ suit. L'aller-retour
 * avec le routeur ne fait ni clignoter le champ ni perdre de caractères.
 */
export function useSearchDraft(urlQ: string, commit: (v: string) => void, delay = 350) {
  const [q, setQ] = useState(urlQ);
  const [prev, setPrev] = useState(urlQ);
  const [sent, setSent] = useState<string | null>(null);
  if (urlQ !== prev) {
    setPrev(urlQ);
    // Notre propre envoi qui arrive : on garde ce qui a été tapé depuis.
    if (urlQ !== sent) setQ(urlQ);
  }
  const commitRef = useRef(commit);
  useEffect(() => { commitRef.current = commit; });
  useEffect(() => {
    const v = q.trim();
    if (v === urlQ.trim()) return;
    const t = window.setTimeout(() => { setSent(v); commitRef.current(v); }, delay);
    return () => window.clearTimeout(t);
  }, [delay, q, urlQ]);
  return [q, setQ] as const;
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
  return <span title="Paroles explicites" className="ml-1.5 inline-flex h-4 items-center rounded-sm bg-rvm-text/20 px-1 align-middle text-[10px] font-bold text-rvm-text">E</span>;
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
        <h1 className="font-rvm-display text-2xl font-black tracking-tight text-rvm-text sm:text-3xl">{title}</h1>
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
          <h2 className="font-rvm-display text-xl font-extrabold tracking-tight text-rvm-text sm:text-2xl">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-rvm-muted">{subtitle}</p> : null}
        </div>
        {href ? (
          <Link href={href} className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1.5 text-[15px] font-bold text-rvm-ink-accent hover:underline">
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
        className="no-scrollbar -mx-1 grid snap-x snap-mandatory auto-cols-[44%] grid-flow-col gap-4 overflow-x-auto px-1 pb-2 @lg:auto-cols-[31%] @3xl:auto-cols-[23.2%] @5xl:auto-cols-[18.4%] @7xl:auto-cols-[15.3%]">
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

/** Nouveautés de l'accueil en attente (mêmes colonnes que la rangée de l'accueil). */
export function CoverGridSkeleton() {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-x-4 gap-y-6 @md:grid-cols-3 @2xl:grid-cols-5 @2xl:gap-x-5">
      {Array.from({ length: HOME_GRID }, (_, i) => (
        <div key={i}>
          <div className="aspect-square rounded-xl bg-rvm-raised motion-safe:animate-pulse" />
          <div className="mt-3 h-3 w-3/4 rounded bg-rvm-raised motion-safe:animate-pulse" />
          <div className="mt-2 h-3 w-1/2 rounded bg-rvm-raised/70 motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function CardRowSkeleton({ count = 6, round = false }: { count?: number; round?: boolean }) {
  return (
    <div aria-hidden className="grid auto-cols-[44%] grid-flow-col gap-4 overflow-hidden @lg:auto-cols-[31%] @3xl:auto-cols-[23.2%] @5xl:auto-cols-[18.4%] @7xl:auto-cols-[15.3%]">
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
        className="mt-4 h-10 rounded-full border border-rvm-line px-5 text-sm font-semibold text-rvm-text hover:border-rvm-ink-accent hover:text-rvm-ink-accent">
        Réessayer
      </button>
    </div>
  );
}

// ── Boutons ────────────────────────────────────────────────────────────────

export const primaryButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-rvm-accent px-5 text-sm font-bold text-rvm-on-accent shadow-lg shadow-rvm-accent/20 transition hover:bg-rvm-accent-hover active:bg-rvm-accent-pressed disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none";
export const secondaryButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-rvm-text/20 px-5 text-sm font-semibold text-rvm-text transition hover:border-rvm-ink-accent hover:text-rvm-ink-accent disabled:cursor-not-allowed disabled:opacity-40";
export const iconButton =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-rvm-muted transition hover:bg-rvm-text/10 hover:text-rvm-text disabled:cursor-not-allowed disabled:opacity-30";

/**
 * « Écouter » d'une page (sortie, playlist, favoris…) : si cette liste joue
 * déjà, le même bouton met en pause et reprend.
 */
export function PlayAllButton({ items, label = "Écouter", className, source, variant = "pill" }: {
  items: QueueItem[]; label?: string; className?: string;
  /** Nom de la sélection (panneau « En cours de lecture »). */
  source?: PlaySource;
  /** « round » : gros bouton rond vert sous l'en-tête d'une liste. */
  variant?: "pill" | "round";
}) {
  const player = useMusicPlayer();
  const playable = items.filter((x) => isPlayable(x.track));
  const curId = player.current?.track.id;
  // « Cette liste joue » : la même sélection (une autre qui contient le titre ne compte pas).
  const isThis = !!curId && (source?.href ? player.source?.href === source.href : items.some((x) => x.track.id === curId));
  const onClick = () => (isThis ? player.toggle() : player.playQueue(items, 0, { source }));
  if (variant === "round") {
    return (
      <button type="button" disabled={playable.length === 0} onClick={onClick}
        aria-label={isThis && player.playing ? "Pause" : isThis ? "Reprendre la lecture" : `${label}${source ? ` : ${source.label}` : ""}`}
        className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-rvm-accent text-rvm-on-accent shadow-xl shadow-rvm-deep/40 transition hover:scale-105 hover:bg-rvm-accent-hover active:scale-95 active:bg-rvm-accent-pressed disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none motion-reduce:hover:scale-100", className)}>
        {isThis && player.playing ? <Pause className="h-6 w-6 fill-current" aria-hidden /> : <Play className="ml-0.5 h-6 w-6 fill-current" aria-hidden />}
      </button>
    );
  }
  return (
    <button type="button" disabled={playable.length === 0}
      onClick={onClick}
      className={cn(primaryButton, className)}>
      {isThis && player.playing ? <Pause className="h-4 w-4 fill-current" aria-hidden /> : <Play className="h-4 w-4 fill-current" aria-hidden />}
      {isThis ? (player.playing ? "Pause" : "Reprendre") : label}
    </button>
  );
}

/** Lecture aléatoire d'une liste (sous l'en-tête des sorties, playlists, favoris). */
export function ShuffleButton({ items, source }: { items: QueueItem[]; source?: PlaySource }) {
  const player = useMusicPlayer();
  const playable = items.some((x) => isPlayable(x.track));
  return (
    <button type="button" disabled={!playable} onClick={() => player.playQueue(items, 0, { source, shuffle: true })}
      aria-label="Lecture aléatoire" title="Lecture aléatoire" className={cn(iconButton, "h-12 w-12 text-rvm-soft")}>
      <Shuffle className="h-6 w-6" aria-hidden />
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
      player.playQueue(toQueue(tracks, r ?? release), 0, { source: { label: release.title, href: `/music/album/${release.id}` } });
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
export function PlayReleaseLabelButton({ release, label = "Écouter", className }: { release: MusicRelease; label?: string; className?: string }) {
  const { isThis, busy, playing, play } = useReleasePlay(release);
  return (
    <button type="button" onClick={play} className={cn(primaryButton, className)}>
      {busy ? <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
        : playing ? <Pause className="h-4 w-4 fill-current" aria-hidden /> : <Play className="h-4 w-4 fill-current" aria-hidden />}
      {isThis ? (playing ? "Pause" : "Reprendre") : label}
    </button>
  );
}

/** « Enregistrer » une sortie dans la bibliothèque du compte (site et app). */
export function SaveReleaseButton({ release, className, variant = "pill" }: { release: MusicRelease; className?: string; variant?: "pill" | "icon" }) {
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
    emitLibraryChange({ kind: "save", id: release.id, on: next });
    dialogs.notify(next ? "Enregistré dans votre bibliothèque" : "Retiré de votre bibliothèque", next ? "success" : "info");
  }

  if (variant === "icon") {
    return (
      <button type="button" onClick={toggle} aria-pressed={saved}
        aria-label={saved ? `Retirer « ${release.title} » de votre bibliothèque` : `Enregistrer « ${release.title} » dans votre bibliothèque`}
        title={saved ? "Retirer de votre bibliothèque" : "Enregistrer dans votre bibliothèque"}
        className={cn(iconButton, "h-12 w-12", saved ? "text-rvm-ink-accent hover:text-rvm-ink-accent" : "text-rvm-soft", className)}>
        {saved ? <CircleCheck className="h-7 w-7 fill-rvm-ink-accent text-rvm-surface" aria-hidden /> : <CirclePlus className="h-7 w-7" aria-hidden />}
      </button>
    );
  }

  return (
    <button type="button" onClick={toggle} aria-pressed={saved}
      className={cn(secondaryButton, saved && "border-rvm-ink-accent text-rvm-ink-accent", className)}>
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
      className={cn("flex h-11 w-11 items-center justify-center rounded-full bg-rvm-accent text-rvm-on-accent shadow-xl shadow-rvm-deep/40 transition hover:scale-105 hover:bg-rvm-accent-hover active:bg-rvm-accent-pressed motion-reduce:transition-none motion-reduce:hover:scale-100", className)}>
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
      className={cn(iconButton, liked && "text-rvm-ink-accent hover:text-rvm-ink-accent", className)}>
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
        <div className={cn("relative overflow-hidden rounded-xl shadow-lg shadow-rvm-deep/30 ring-1 ring-rvm-text/5", isThis && "ring-2 ring-rvm-ink-accent")}>
          <Cover url={release.cover_url} size={320} alt="" rounded="rounded-xl" priority={priority}
            className="w-full transition duration-300 motion-safe:group-hover:scale-[1.03]" />
          {release.is_premium ? <PremiumTag className="absolute left-2 top-2" /> : null}
        </div>
        <p className={cn("mt-2.5 truncate text-[15px] font-semibold", isThis ? "text-rvm-ink-accent" : "text-rvm-text")}>{release.title}</p>
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
      isThis ? "border-rvm-ink-accent/70" : "border-rvm-line")}>
      <Link href={`/music/album/${release.id}`} className="relative shrink-0" tabIndex={-1} aria-hidden>
        <Cover url={release.cover_url} size={320} alt="" className="h-24 w-24 shadow-lg shadow-rvm-deep/40 sm:h-28 sm:w-28" rounded="rounded-xl" />
        {release.is_premium ? <PremiumTag className="absolute left-1.5 top-1.5" /> : null}
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/music/album/${release.id}`}
          className={cn("block truncate text-base font-bold after:absolute after:inset-0 after:rounded-2xl", isThis ? "text-rvm-ink-accent" : "text-rvm-text")}>
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
        className={cn("grid gap-3", releases.length === 1 ? "max-w-2xl" : releases.length === 2 ? "@xl:grid-cols-2" : "@xl:grid-cols-2 @5xl:grid-cols-3")}>
        {releases.map((r) => <div key={r.id} role="listitem" className="min-w-0"><ReleaseTile release={r} /></div>)}
      </div>
    );
  }
  return <CardRow label={label}>{releases.map((r, i) => <ReleaseCard key={r.id} release={r} priority={i < 2} />)}</CardRow>;
}

/** Artiste à découvrir : portrait rond (ou initiale), nom, « Suivre ». */
export function ArtistFollowCard({ artist }: { artist: MusicArtist }) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <Link href={`/artist/${artist.id}`} className="group flex max-w-full flex-col items-center rounded-xl p-1">
        <span className="block w-28 overflow-hidden rounded-full shadow-lg shadow-rvm-deep/30 ring-1 ring-rvm-text/5">
          {artist.avatar_url ? (
            <Cover url={artist.avatar_url} size={320} alt="" rounded="rounded-full"
              className="w-full transition duration-300 motion-safe:group-hover:scale-[1.04]" />
          ) : (
            <span className="flex aspect-square items-center justify-center rounded-full bg-gradient-to-br from-rvm-brand/40 to-rvm-raised text-3xl font-black text-rvm-text">
              {artist.name.trim().charAt(0).toUpperCase() || <UserRound className="h-1/3 w-1/3" aria-hidden />}
            </span>
          )}
        </span>
        <span className="mt-2.5 block max-w-full truncate text-[15px] font-bold text-rvm-text group-hover:text-rvm-ink-accent">{artist.name}</span>
      </Link>
      <FollowArtistButton artist={artist} compact className="mt-1.5" />
    </div>
  );
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
              <span className="block truncate text-[15px] font-semibold text-rvm-text group-hover:text-rvm-ink-accent">{a.name}</span>
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
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 @lg:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-5 @7xl:grid-cols-6">
      {releases.map((r) => <ReleaseCard key={r.id} release={r} />)}
    </div>
  );
}

export function ArtistCard({ artist }: { artist: MusicArtist }) {
  return (
    <Link href={`/artist/${artist.id}`} className="group block rounded-xl p-1 text-center">
      <div className="mx-auto w-full max-w-[160px] overflow-hidden rounded-full shadow-lg shadow-rvm-deep/30 ring-1 ring-rvm-text/5">
        {artist.avatar_url ? (
          <Cover url={artist.avatar_url} size={320} alt="" rounded="rounded-full"
            className="w-full transition duration-300 motion-safe:group-hover:scale-[1.04]" />
        ) : (
          <div className="flex aspect-square items-center justify-center rounded-full bg-gradient-to-br from-rvm-brand/40 to-rvm-raised text-2xl font-black text-rvm-text sm:text-3xl">
            {artist.name.trim().charAt(0).toUpperCase() || <UserRound className="h-1/3 w-1/3" aria-hidden />}
          </div>
        )}
      </div>
      <p className="mt-2.5 truncate text-[15px] font-semibold text-rvm-text group-hover:text-rvm-ink-accent">{artist.name}</p>
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
 * lui ; le titre en cours est en vert, avec l'égaliseur. Les colonnes
 * (album, date, durée) suivent la largeur du PANNEAU central (requêtes de
 * conteneur), pas celle de la fenêtre.
 */
export function TrackList({
  items, showAlbum = true, showCover = true, numbered = false, ranks, menuExtra, hideRelease = false, label = "Titres",
  highlight = null, source, dateLabel, stickyHeader = false, showHeader = true,
}: {
  items: QueueItem[];
  /** En-tête des colonnes (#, Titre, durée) ; l'accueil s'en passe. */
  showHeader?: boolean;
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
  /** Sélection d'où part la lecture (panneau « En cours de lecture »). */
  source?: PlaySource;
  /** Colonne de date (« Date d'ajout », « Écouté ») lue dans `track.added_at`. */
  dateLabel?: string;
  /** En-tête des colonnes collé sous la barre compacte de la page. */
  stickyHeader?: boolean;
}) {
  const player = useMusicPlayer();
  const library = useMusicLibrary();
  const { ensureLikes } = library;
  const ids = items.map((x) => x.track.id).join(",");
  useEffect(() => { if (ids) ensureLikes(ids.split(",")); }, [ensureLikes, ids]);
  const [now] = useState(() => Date.now());

  return (
    <div>
      <div aria-hidden className={cn("mb-1 hidden items-center gap-3 border-b border-rvm-line px-2 py-2 text-xs font-semibold uppercase tracking-wider text-rvm-soft",
        showHeader && "@md:flex", stickyHeader && "sticky top-16 z-10 bg-rvm-surface")}>
        <span className="w-8 text-center">#</span>
        <span className="min-w-0 flex-1">Titre</span>
        {showAlbum ? <span className="hidden w-[24%] @3xl:block">Album</span> : null}
        {dateLabel ? <span className="hidden w-32 @4xl:block">{dateLabel}</span> : null}
        <span className="flex w-12 justify-end"><Clock3 className="h-4 w-4" aria-label="Durée" /></span>
        <span className="w-[5.25rem]" />
      </div>
      <ol aria-label={label}>
        {items.map((item, i) => {
          const { track: t, release: r } = item;
          const playable = isPlayable(t);
          const isCurrent = player.current?.track.id === t.id;
          const locked = !!r.is_premium && !t.is_free;
          const rank = ranks?.get(t.id);
          const play = () => { if (!playable) return; if (isCurrent) player.toggle(); else player.playQueue(items, i, { source }); };
          return (
            <li key={`${t.id}-${i}`} id={`t-${t.id}`} onDoubleClick={play}
              className={cn("group flex scroll-mt-32 items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-rvm-text/[0.07]",
                isCurrent && "bg-rvm-accent/25 hover:bg-rvm-accent/30", highlight === t.id && "ring-1 ring-rvm-ink-accent/70",
                !playable && "opacity-60")}>
              <div className="relative flex h-10 w-8 shrink-0 flex-col items-center justify-center">
                {isCurrent ? <Equalizer paused={!player.playing} className="group-hover:invisible group-focus-within:invisible" />
                  : rank ? (
                    <span className="flex flex-col items-center leading-none group-hover:invisible group-focus-within:invisible">
                      <span className={cn("text-sm font-black tabular-nums", rank.rank <= 3 ? "text-rvm-ink-accent" : "text-rvm-text")}>{rank.rank}</span>
                      {rank.move ? <span className="mt-0.5 text-[10px] text-rvm-muted">{rank.move}</span> : null}
                    </span>
                  ) : (
                    <span className="text-[15px] tabular-nums text-rvm-soft group-hover:invisible group-focus-within:invisible">{numbered ? t.position : i + 1}</span>
                  )}
                <button type="button" onClick={play} disabled={!playable}
                  aria-label={isCurrent && player.playing ? `Mettre en pause ${t.title}` : `Écouter ${t.title}`}
                  className="absolute inset-0 flex items-center justify-center rounded-md text-rvm-text opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 disabled:hidden">
                  {isCurrent && player.playing ? <Pause className="h-4 w-4 fill-current" aria-hidden /> : <Play className="h-4 w-4 fill-current" aria-hidden />}
                </button>
              </div>
              {showCover ? <Cover url={r.cover_url} size={160} alt="" className="h-10 w-10 shrink-0" rounded="rounded" /> : null}
              <div className="min-w-0 flex-1">
                <button type="button" onClick={play} disabled={!playable} tabIndex={-1}
                  className={cn("block max-w-full truncate text-left text-[15px] font-semibold", isCurrent ? "text-rvm-ink-accent" : "text-rvm-text")}>
                  {t.title}{t.explicit ? <ExplicitTag /> : null}
                </button>
                <span className="block truncate text-[13px] text-rvm-soft">
                  {r.artist_id ? <Link href={`/artist/${r.artist_id}`} className="hover:text-rvm-text hover:underline">{trackSubtitle(t, r)}</Link> : trackSubtitle(t, r)}
                </span>
              </div>
              {showAlbum ? (
                <span className="hidden w-[24%] min-w-0 truncate text-sm text-rvm-soft @3xl:block">
                  {hideRelease ? r.title : <Link href={`/music/album/${r.id}`} className="hover:text-rvm-text hover:underline">{r.title}</Link>}
                </span>
              ) : null}
              {dateLabel ? <span className="hidden w-32 truncate text-sm text-rvm-soft @4xl:block">{addedAtLabel(t.added_at, now)}</span> : null}
              <span className="flex shrink-0 items-center gap-1.5">
                {!playable ? <span className="text-xs text-rvm-muted">Bientôt</span>
                  : locked ? <Lock className="h-3.5 w-3.5 text-rvm-premium" aria-label="Premium" />
                  : r.is_premium && t.is_free ? <span className="text-xs font-semibold text-rvm-premium">Offert</span> : null}
                <span className="hidden w-12 text-right text-[13px] tabular-nums text-rvm-soft @md:block">{formatDuration(t.duration_seconds)}</span>
              </span>
              <LikeButton track={t} size="h-[18px] w-[18px]" className="hidden @md:inline-flex" />
              <TrackMenuButton item={item} extra={menuExtra?.(item, i)} hideRelease={hideRelease} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── File d'attente (panneau « En cours de lecture », lecteur agrandi) ──────

/** Ligne de la file : toucher la joue ; la croix la retire (sauf le titre en cours). */
function QueueRow({ item, i, current }: { item: QueueItem; i: number; current: boolean }) {
  const p = useMusicPlayer();
  return (
    <li className={cn("group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-rvm-text/[0.07]", current && "bg-rvm-accent/25")}>
      <button type="button" onClick={() => (current ? p.toggle() : p.playAt(i))} className="flex min-w-0 flex-1 items-center gap-3 text-left"
        aria-label={current ? (p.playing ? `Mettre en pause ${item.track.title}` : `Reprendre ${item.track.title}`) : `Écouter ${item.track.title}`}>
        <Cover url={item.release.cover_url} size={160} alt="" className="h-11 w-11 shrink-0" rounded="rounded" />
        <span className="min-w-0 flex-1">
          <span className={cn("flex items-center gap-2 truncate text-[15px] font-semibold", current ? "text-rvm-ink-accent" : "text-rvm-text")}>
            {current ? <Equalizer paused={!p.playing} /> : null}<span className="truncate">{item.track.title}</span>
          </span>
          <span className="block truncate text-[13px] text-rvm-soft">{artistName(item.release)}</span>
        </span>
      </button>
      {!current ? (
        <button type="button" onClick={() => p.removeAt(i)} aria-label={`Retirer « ${item.track.title} » de la file`}
          className={cn(iconButton, "h-9 w-9 opacity-100 @sm:opacity-0 @sm:group-hover:opacity-100 @sm:focus-visible:opacity-100")}>
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </li>
  );
}

/** « En cours », puis « À suivre » (au plus `limit` titres affichés). */
export function QueueList({ limit = 100 }: { limit?: number }) {
  const p = useMusicPlayer();
  const cur = p.current;
  const upcoming = p.queue.slice(p.index + 1, p.index + 1 + limit);
  const left = p.queue.length - p.index - 1;
  return (
    <div className="@container">
      {cur ? (
        <>
          <h3 className="px-2 text-sm font-bold text-rvm-text">En cours de lecture</h3>
          <ul className="mt-1"><QueueRow item={cur} i={p.index} current /></ul>
        </>
      ) : null}
      <div className="mt-5 flex items-center justify-between gap-2 px-2">
        <h3 className="text-sm font-bold text-rvm-text">
          À suivre{p.source ? <span className="font-normal text-rvm-soft"> · {p.source.label}</span> : null}
        </h3>
        {left > 0 ? (
          <button type="button" onClick={p.clearUpcoming} className="rounded-full px-2 py-1 text-[13px] font-semibold text-rvm-soft hover:text-rvm-text">
            Effacer la file
          </button>
        ) : null}
      </div>
      {upcoming.length === 0 ? (
        <p className="px-2 pt-2 text-sm text-rvm-soft">La file d’attente est vide. Ajoutez des titres avec le menu « … ».</p>
      ) : (
        <ul className="mt-1">
          {upcoming.map((item, k) => <QueueRow key={`${item.track.id}-${p.index + 1 + k}`} item={item} i={p.index + 1 + k} current={false} />)}
        </ul>
      )}
      {left > upcoming.length ? <p className="px-2 pt-2 text-[13px] text-rvm-soft">Et {left - upcoming.length} autres titres.</p> : null}
    </div>
  );
}

// ── Suivre un artiste (page d'artiste, panneau « En cours de lecture ») ────

export function FollowArtistButton({ artist, className, compact = false }: {
  artist: Pick<MusicArtist, "id" | "user_id" | "name">; className?: string; compact?: boolean;
}) {
  const { user } = useAuth();
  const dialogs = useDialogs();
  const library = useMusicLibrary();
  const [following, setFollowingState] = useState(false);
  const [busy, setBusy] = useState(false);
  const personId = artist.user_id;

  useEffect(() => {
    if (!user || !personId) { setFollowingState(false); return; }
    let alive = true;
    void isFollowing(personId).then((v) => { if (alive) setFollowingState(v); }).catch(() => {});
    return () => { alive = false; };
  }, [user, personId]);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<LibraryEventDetail>).detail;
      if (d?.kind === "follow" && d.id === personId) setFollowingState(d.on);
    };
    window.addEventListener(MUSIC_LIBRARY_EVENT, on);
    return () => window.removeEventListener(MUSIC_LIBRARY_EVENT, on);
  }, [personId]);

  if (!personId) return null;

  async function toggle() {
    if (!personId) return;
    if (!user) { library.requireLogin({ kind: "follow", id: personId, label: artist.name }); return; }
    setBusy(true);
    const err = await setFollowing(personId, !following);
    setBusy(false);
    if (err) { dialogs.notify(err === "blocked" ? "Action impossible avec ce compte." : "Action impossible pour l’instant.", "error"); return; }
    setFollowingState(!following);
    emitLibraryChange({ kind: "follow", id: personId, on: !following });
  }

  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={following}
      aria-label={following ? `Ne plus suivre ${artist.name}` : `Suivre ${artist.name}`}
      className={cn(compact
        ? "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold transition-colors"
        : secondaryButton,
        following ? "border-rvm-ink-accent text-rvm-ink-accent" : "border-rvm-text/30 text-rvm-text hover:border-rvm-text", className)}>
      {following ? <UserCheck className="h-4 w-4" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />}
      {following ? "Abonné" : "Suivre"}
    </button>
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
            className={cn("flex w-full items-center gap-3 text-left text-sm hover:bg-rvm-text/10 focus:bg-rvm-text/10 focus:outline-none",
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
