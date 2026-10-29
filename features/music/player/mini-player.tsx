"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CassetteTape, ChevronDown, ListMusic, LoaderCircle, Maximize2, Music2, PanelRight, Pause, Play, Repeat, Repeat1, Shuffle,
  SkipBack, SkipForward, Volume1, Volume2, VolumeX, X,
} from "lucide-react";
import { isMusicPath } from "@/components/layout/hide-in-music";
import { cn } from "@/lib/utils/cn";
import { IconTile } from "../music-collection";
import { useMusicLayoutOptional } from "../music-layout";
import { artistName, formatPlayerTime, playerDuration, releaseKindLabel } from "../music-logic";
import { Cover, Equalizer, LikeButton, QueueList, TrackMenuButton, iconButton } from "../music-ui";
import { CassetteDeck, useMediaQuery, type DeckState } from "./cassette-player";
import { useMusicPlayer, useMusicProgress, type QueueItem } from "./music-player-provider";

/**
 * Lecteur de Rivendy Musique. UN seul élément <audio> pour tout le site
 * (music-player-provider) ; ce fichier n'en est que l'affichage :
 * - dans l'espace Musique (mise en page application du 2026-10-22) : la
 *   barre permanente en trois groupes (`MusicPlayerBar`), le mini-lecteur
 *   du téléphone au-dessus de la navigation (`MobileMiniPlayer`) ;
 * - ailleurs sur le site : la barre flottante (`MiniPlayer`), visible
 *   seulement quand un titre est chargé, avec un espace réservé en bas.
 * Changer de page ou de disposition garde le titre, sa position et la file.
 */

/** Hors de la Musique : barre flottante en bas de page. */
export function MiniPlayer() {
  const p = useMusicPlayer();
  const pathname = usePathname();
  const [queueOpen, setQueueOpen] = useState(false);
  const bar = useRef<HTMLElement>(null);
  const cur = p.current;
  const inMusic = isMusicPath(pathname);
  // Un titre seulement préparé par l'accueil de la Musique ne suit pas l'auditeur ailleurs.
  const shown = !!cur && !inMusic && !p.hint;

  useEffect(() => {
    const root = document.documentElement;
    const el = bar.current;
    if (!shown || !el) { root.style.setProperty("--rvm-player-h", "0px"); return; }
    const set = () => root.style.setProperty("--rvm-player-h", `${Math.round(el.getBoundingClientRect().height)}px`);
    set();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(set) : null;
    ro?.observe(el);
    return () => { ro?.disconnect(); root.style.setProperty("--rvm-player-h", "0px"); };
  }, [shown]);

  // Dans la Musique, la coque affiche son propre lecteur.
  if (inMusic) return null;
  if (!cur || p.hint) return null;

  return (
    <>
      <div aria-hidden className="h-[calc(var(--rvm-player-h,76px)+8px)]" />
      <section ref={bar} aria-label="Lecteur Rivendy Musique"
        className="rvm-scope rvm-deep fixed inset-x-0 bottom-0 z-[45] border-t border-rvm-line bg-rvm-panel/95 pb-[env(safe-area-inset-bottom)] text-rvm-text shadow-[0_-8px_30px_rgba(0,0,0,0.35)] backdrop-blur-md">
        <MobileProgress />
        <div className="mx-auto grid h-[74px] max-w-[1680px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 md:h-[90px] md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] md:gap-4 md:px-5">
          <NowPlaying item={cur} />
          <div className="hidden min-w-0 flex-col items-center gap-1 md:flex">
            <Controls size="bar" />
            <Seek className="w-full max-w-xl" />
          </div>
          {/* Téléphone : lecture, suivant, fermer. */}
          <div className="flex items-center gap-1 md:hidden">
            <PlayPause size="sm" />
            <button type="button" onClick={p.next} disabled={p.index >= p.queue.length - 1 && p.repeat === "off"}
              aria-label="Titre suivant" className={cn(iconButton, "h-11 w-11")}>
              <SkipForward className="h-5 w-5 fill-current" aria-hidden />
            </button>
            <button type="button" onClick={p.close} aria-label="Fermer le lecteur" className={cn(iconButton, "h-11 w-11")}>
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="hidden items-center justify-end gap-1 md:flex">
            <button type="button" onClick={() => setQueueOpen((o) => !o)} aria-pressed={queueOpen} aria-label="File d’attente"
              className={cn(iconButton, queueOpen && "text-rvm-ink-accent hover:text-rvm-ink-accent")}>
              <ListMusic className="h-5 w-5" aria-hidden />
            </button>
            <Volume />
            <button type="button" onClick={() => { setQueueOpen(false); p.setExpanded(true); }} aria-label="Agrandir le lecteur" className={iconButton}>
              <Maximize2 className="h-[18px] w-[18px]" aria-hidden />
            </button>
            <button type="button" onClick={() => { setQueueOpen(false); p.close(); }} aria-label="Fermer le lecteur" className={iconButton}>
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      </section>
      {queueOpen ? <QueuePanel onClose={() => setQueueOpen(false)} /> : null}
      {p.expanded ? <FullPlayer /> : null}
    </>
  );
}

/**
 * Lecteur permanent de l'espace Musique (≥ 768 px), sur toute la largeur :
 * à gauche le titre et le favori, au centre les commandes et la
 * progression, à droite le panneau « En cours de lecture », la file, le
 * volume et la vue agrandie. Sans titre chargé, il reste là, inactif.
 */
export function MusicPlayerBar() {
  const p = useMusicPlayer();
  const layout = useMusicLayoutOptional();
  const cur = p.current;
  const nowOpen = !!layout?.rightVisible && layout.rightMode === "now";
  const queueOpen = !!layout?.rightVisible && layout.rightMode === "queue";
  return (
    <>
      <section aria-label="Lecteur Rivendy Musique"
        className="rvm-scope rvm-deep hidden h-[84px] shrink-0 grid-cols-[minmax(180px,1fr)_minmax(0,1.6fr)_minmax(180px,1fr)] items-center gap-4 px-4 text-rvm-text md:grid">
        {cur ? <NowPlaying item={cur} /> : (
          <p className="truncate text-sm text-rvm-soft">Choisissez un titre pour l’écouter.</p>
        )}
        <div className="flex min-w-0 flex-col items-center gap-1">
          <Controls size="bar" />
          <Seek className="w-full max-w-2xl" />
        </div>
        <div className="flex items-center justify-end gap-0.5">
          <button type="button" onClick={layout?.toggleNowPlaying} disabled={!cur} aria-pressed={nowOpen}
            aria-label={nowOpen ? "Masquer le panneau En cours de lecture" : "Afficher le panneau En cours de lecture"}
            title="En cours de lecture" className={cn(iconButton, nowOpen && "text-rvm-ink-accent hover:text-rvm-ink-accent")}>
            <PanelRight className="h-5 w-5" aria-hidden />
          </button>
          <button type="button" onClick={layout?.toggleQueue} disabled={!cur} aria-pressed={queueOpen}
            aria-label={queueOpen ? "Masquer la file d’attente" : "Afficher la file d’attente"}
            title="File d’attente" className={cn(iconButton, queueOpen && "text-rvm-ink-accent hover:text-rvm-ink-accent")}>
            <ListMusic className="h-5 w-5" aria-hidden />
          </button>
          <Volume />
          <button type="button" onClick={() => p.setExpanded(true)} disabled={!cur} aria-label="Agrandir le lecteur" title="Agrandir"
            className={iconButton}>
            <Maximize2 className="h-[18px] w-[18px]" aria-hidden />
          </button>
        </div>
      </section>
      {p.expanded ? <FullPlayer /> : null}
    </>
  );
}

/** Téléphone, dans la Musique : mini-lecteur posé au-dessus de la navigation du bas. */
export function MobileMiniPlayer() {
  const p = useMusicPlayer();
  const cur = p.current;
  if (!cur) return null;
  const { track: t, release: r } = cur;
  return (
    <section aria-label="Lecteur Rivendy Musique" className="rvm-scope rvm-deep relative mx-2 mb-1.5 overflow-hidden rounded-2xl text-rvm-text shadow-lg shadow-rvm-deep/30 md:hidden">
      <div className="flex h-14 items-center gap-2.5 pl-2 pr-1">
        <button type="button" onClick={() => p.setExpanded(true)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          aria-label={`Agrandir le lecteur : ${t.title}, ${artistName(r)}`}>
          <Cover url={r.cover_url} size={160} alt="" className="h-10 w-10 shrink-0" rounded="rounded" />
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold">{t.title}</span>
            <span className="block truncate text-[13px] text-rvm-soft">
              {p.hint ? <span className="font-semibold text-rvm-ink-accent">{p.hint} · </span> : null}{artistName(r)}
            </span>
          </span>
        </button>
        <LikeButton track={t} className="h-11 w-11" />
        <PlayPause size="sm" />
      </div>
      <MobileProgress inside />
    </section>
  );
}

/** Pochette, titre, artiste, favori. */
function NowPlaying({ item }: { item: QueueItem }) {
  const p = useMusicPlayer();
  const { track: t, release: r } = item;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <button type="button" onClick={() => p.setExpanded(true)} aria-label="Agrandir le lecteur" className="relative shrink-0 rounded-md">
        <Cover url={r.cover_url} size={160} alt="" className="h-12 w-12 shadow-lg md:h-14 md:w-14" rounded="rounded-md" />
      </button>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Link href={`/music/album/${r.id}?t=${t.id}`} className="hidden truncate text-[15px] font-semibold hover:underline md:block">{t.title}</Link>
          <button type="button" onClick={() => p.setExpanded(true)} className="min-h-7 truncate text-left text-[15px] font-semibold md:hidden">{t.title}</button>
          {p.preview ? <span className="shrink-0 rounded bg-rvm-premium/20 px-1.5 text-[10px] font-bold text-rvm-premium">Extrait</span> : null}
        </div>
        <p className="truncate text-[13px] text-rvm-soft">
          {/* Titre prêt, pas encore lancé : « Reprendre l’écoute », « N° 1 du Rivendy Hit ». */}
          {p.hint ? <span className="font-semibold text-rvm-ink-accent">{p.hint} · </span> : null}
          {r.artist_id
            ? <Link href={`/artist/${r.artist_id}`} className="hover:text-rvm-text hover:underline">{artistName(r)}</Link>
            : artistName(r)}
        </p>
      </div>
      <LikeButton track={t} className="hidden md:inline-flex" />
    </div>
  );
}

function PlayPause({ size }: { size: "sm" | "md" | "lg" }) {
  const p = useMusicPlayer();
  const dims = size === "lg" ? "h-16 w-16" : "h-11 w-11";
  const icon = size === "lg" ? "h-7 w-7" : "h-5 w-5";
  return (
    <button type="button" onClick={p.toggle} disabled={!p.current} aria-label={p.playing ? "Pause" : "Lecture"}
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-rvm-accent text-rvm-on-accent shadow-lg shadow-rvm-accent/25 transition hover:scale-105 hover:bg-rvm-accent-hover active:scale-95 active:bg-rvm-accent-pressed disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:scale-100 motion-reduce:transition-none motion-reduce:hover:scale-100", dims)}>
      {p.loading ? <LoaderCircle className={cn(icon, "motion-safe:animate-spin")} aria-hidden />
        : p.playing ? <Pause className={cn(icon, "fill-current")} aria-hidden />
        : <Play className={cn(icon, "ml-0.5 fill-current")} aria-hidden />}
    </button>
  );
}

/** Aléatoire, précédent, lecture, suivant, répétition. */
function Controls({ size }: { size: "bar" | "full" }) {
  const p = useMusicPlayer();
  const big = size === "full";
  const none = !p.current;
  const repeatLabel = p.repeat === "off" ? "Répétition désactivée" : p.repeat === "all" ? "Répéter toute la file" : "Répéter ce titre";
  return (
    <div className={cn("flex items-center", big ? "gap-4 sm:gap-6" : "gap-2")}>
      <button type="button" onClick={p.toggleShuffle} disabled={none} aria-pressed={p.shuffled} aria-label="Lecture aléatoire"
        className={cn(iconButton, p.shuffled && "text-rvm-ink-accent hover:text-rvm-ink-accent")}>
        <Shuffle className={big ? "h-5 w-5" : "h-4 w-4"} aria-hidden />
      </button>
      <button type="button" onClick={p.previous} disabled={none} aria-label="Titre précédent" className={cn(iconButton, "text-rvm-text")}>
        <SkipBack className={cn(big ? "h-7 w-7" : "h-5 w-5", "fill-current")} aria-hidden />
      </button>
      <PlayPause size={big ? "lg" : "md"} />
      <button type="button" onClick={p.next} disabled={none || (p.index >= p.queue.length - 1 && p.repeat === "off")} aria-label="Titre suivant"
        className={cn(iconButton, "text-rvm-text")}>
        <SkipForward className={cn(big ? "h-7 w-7" : "h-5 w-5", "fill-current")} aria-hidden />
      </button>
      <button type="button" onClick={p.cycleRepeat} disabled={none} aria-pressed={p.repeat !== "off"} aria-label={repeatLabel} title={repeatLabel}
        className={cn(iconButton, p.repeat !== "off" && "text-rvm-ink-accent hover:text-rvm-ink-accent")}>
        {p.repeat === "one" ? <Repeat1 className={big ? "h-5 w-5" : "h-4 w-4"} aria-hidden /> : <Repeat className={big ? "h-5 w-5" : "h-4 w-4"} aria-hidden />}
      </button>
    </div>
  );
}

/** Durée affichée : fichier chargé, sinon durée vérifiée du titre en base (jamais « 0:00 » à tort). */
function useShownDuration(): { position: number; total: number | null; ready: boolean } {
  const p = useMusicPlayer();
  const { position, duration, ready } = useMusicProgress();
  const total = playerDuration({ ready, mediaDuration: duration, trackDuration: p.current?.track.duration_seconds });
  return { position, total, ready };
}

/**
 * Progression : glisser déplace dans le titre au relâchement ; au clavier
 * (flèches), le déplacement est immédiat. Tant que le fichier n'est pas
 * chargé (file reprise, chargement), la barre est inactive et la durée
 * affichée est celle du titre ; « –:–– » si elle n'est pas connue.
 */
function Seek({ className, large = false }: { className?: string; large?: boolean }) {
  const p = useMusicPlayer();
  const { position, total, ready } = useShownDuration();
  const [drag, setDrag] = useState<number | null>(null);
  const dragging = useRef(false);
  const max = Math.max(1, Math.floor(total ?? 0));
  const value = Math.min(drag ?? position, max);
  const pct = total ? Math.min(100, (value / total) * 100) : 0;
  const commit = (v: number) => { dragging.current = false; p.seek(v); setDrag(null); };
  const loadingLabel = p.loading && !ready;
  return (
    <div className={cn("flex items-center gap-2 text-xs tabular-nums text-rvm-soft", className)}>
      <span className="w-10 text-right">{p.current ? formatPlayerTime(value) : "–:––"}</span>
      <input type="range" min={0} max={max} step={1} value={Math.floor(value)} disabled={!ready || !p.current}
        onPointerDown={() => { dragging.current = true; }}
        onChange={(e) => { const v = Number(e.target.value); if (dragging.current) setDrag(v); else p.seek(v); }}
        onPointerUp={(e) => { if (dragging.current) commit(Number(e.currentTarget.value)); }}
        onPointerCancel={() => { dragging.current = false; setDrag(null); }}
        aria-label="Position dans le titre"
        aria-valuetext={loadingLabel ? "Chargement du titre" : `${formatPlayerTime(value)} sur ${formatPlayerTime(total)}`}
        style={{ "--pct": `${pct}%` } as CSSProperties}
        className={cn("rvm-range min-w-0 flex-1", large && "rvm-range-lg")} />
      <span className="w-10" title={ready ? undefined : "Durée du titre (fichier pas encore chargé)"}>{p.current ? formatPlayerTime(total) : "–:––"}</span>
    </div>
  );
}

function MobileProgress({ inside = false }: { inside?: boolean }) {
  const { position, total } = useShownDuration();
  const pct = total ? Math.min(100, (position / total) * 100) : 0;
  return (
    <div role="progressbar" aria-label="Progression du titre" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
      className={cn("bg-rvm-text/10 md:hidden", inside ? "absolute inset-x-2 bottom-0 h-[2px]" : "h-[3px]")}>
      <div className="h-full bg-rvm-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Volume({ large = false }: { large?: boolean }) {
  const p = useMusicPlayer();
  const v = p.muted ? 0 : Math.round(p.volume * 100);
  const Icon = v === 0 ? VolumeX : v < 50 ? Volume1 : Volume2;
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={p.toggleMute} aria-pressed={p.muted} aria-label={p.muted ? "Réactiver le son" : "Couper le son"} className={iconButton}>
        <Icon className="h-5 w-5" aria-hidden />
      </button>
      <input type="range" min={0} max={100} step={1} value={v} onChange={(e) => p.setVolume(Number(e.target.value) / 100)}
        aria-label="Volume" aria-valuetext={`${v} %`} style={{ "--pct": `${v}%` } as CSSProperties}
        className={cn("rvm-range hidden lg:block", large ? "rvm-range-lg w-32" : "w-24")} />
    </div>
  );
}

/** Panneau « File d'attente » des autres pages du site, au-dessus du lecteur flottant. */
function QueuePanel({ onClose }: { onClose: () => void }) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  const [top, setTop] = useState(64);
  useLayoutEffect(() => {
    const h = Math.round(document.querySelector("header")?.getBoundingClientRect().bottom ?? 0);
    if (h > 0) setTop(h);
  }, []);
  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return (
    <aside aria-label="File d’attente" style={{ top }}
      className="rvm-scope fixed bottom-[var(--rvm-player-h,90px)] right-0 z-[46] hidden w-[380px] flex-col border-l border-rvm-line bg-rvm-panel text-rvm-text shadow-2xl md:flex">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-lg font-bold">File d’attente</h2>
        <button ref={closeBtn} type="button" onClick={onClose} aria-label="Fermer la file d’attente" className={iconButton}>
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4"><QueueList /></div>
    </aside>
  );
}

/** « Mode cassette » : la radio-cassette (par défaut) ou la grande pochette ; un confort du navigateur. */
const CASSETTE_KEY = "rivendy_music_cassette_v1";

function useCassetteMode(): [boolean, (on: boolean) => void] {
  // Le lecteur agrandi ne s'affiche qu'après un geste, jamais au rendu serveur : lecture directe.
  const [on, setOn] = useState(() => {
    try { return localStorage.getItem(CASSETTE_KEY) !== "off"; } catch { return true; }
  });
  const set = useCallback((v: boolean) => {
    setOn(v);
    try { localStorage.setItem(CASSETTE_KEY, v ? "on" : "off"); } catch { /* stockage indisponible */ }
  }, []);
  return [on, set];
}

/**
 * Vue agrandie « radio-cassette » (2026-10-29, maquette du propriétaire) :
 * la radio-cassette Rivendy (ordinateur, tablette) ou une cassette compacte
 * (téléphone, écran bas), le titre et les commandes dessous, la file
 * d'attente à droite (dessous sur petit écran). Le décor suit l'état réel du
 * lecteur et ne touche ni au son ni aux médias. Ouvrir, réduire, rouvrir :
 * même titre, même position, même file (tout vit dans le lecteur du site).
 */
function FullPlayer() {
  const p = useMusicPlayer();
  const cur = p.current;
  const reduce = useRef<HTMLButtonElement>(null);
  const { setExpanded } = p;
  const [cassette, setCassette] = useCassetteMode();
  // Téléphone ou écran bas (paysage) : la cassette seule, plus compacte.
  const compact = useMediaQuery("(max-width: 767px), (max-height: 560px)");
  // Téléphone en paysage : la cassette à gauche, le titre et les commandes à droite.
  const sideBySide = useMediaQuery("(max-height: 560px) and (min-width: 560px) and (orientation: landscape)");
  useEffect(() => {
    reduce.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [setExpanded]);
  if (!cur) return null;
  const { track: t, release: r } = cur;
  const close = () => p.setExpanded(false);
  const state: DeckState = p.loading ? "loading" : p.playing ? "playing" : "paused";
  const albumHref = `/music/album/${r.id}`;
  const fromAlbum = p.source?.href === albumHref;

  return (
    <div role="dialog" aria-modal="true" aria-label="Lecteur agrandi" className="rvm-scope fixed inset-0 z-[55] overflow-y-auto overflow-x-hidden bg-rvm-ground text-rvm-text">
      <PlayerBackdrop />
      <div className="relative mx-auto flex min-h-full max-w-[1500px] flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-2 py-2 sm:grid sm:grid-cols-[1fr_auto_1fr]">
          <button ref={reduce} type="button" onClick={close}
            className="inline-flex h-11 items-center gap-1.5 justify-self-start rounded-full px-2 text-[15px] font-semibold text-rvm-text hover:bg-rvm-text/[0.07]">
            <ChevronDown className="h-5 w-5" aria-hidden /> Réduire
          </button>
          <Link href="/music" onClick={close} aria-label="Rivendy Musique, accueil"
            className="hidden items-center gap-3 rounded-md sm:flex">
            <Image src="/brand/rivendy-wordmark.png" alt="" width={1214} height={428} className="h-7 w-auto lg:h-8" />
            <span className="text-[12px] font-extrabold uppercase tracking-[0.34em] text-rvm-deep lg:text-[13px]">Musique</span>
          </Link>
          <div className="flex items-center justify-self-end gap-1">
            <button type="button" onClick={() => setCassette(!cassette)} aria-pressed={cassette} title="Mode cassette"
              className={cn("inline-flex h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors sm:px-4",
                cassette ? "border-rvm-ink-accent/30 bg-rvm-raised text-rvm-text" : "border-rvm-line bg-rvm-surface text-rvm-soft hover:text-rvm-text")}>
              <CassetteTape className="h-5 w-5" aria-hidden /><span className="hidden sm:inline">Mode cassette</span><span className="sr-only sm:hidden">Mode cassette</span>
            </button>
            <TrackMenuButton item={cur} onOpenPage={close} />
          </div>
        </header>

        <div className="grid flex-1 gap-8 pb-2 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:gap-10">
          <section aria-label="Lecture en cours"
            className={cn("flex min-w-0 flex-col items-center", sideBySide && "grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-6")}>
            <div className="flex w-full flex-col items-center">
              <p className="max-w-full text-center">
                <span className="block text-[12px] font-extrabold uppercase tracking-[0.3em] text-rvm-soft">Vous écoutez</span>
                <span className="mt-0.5 block truncate font-rvm-display text-lg font-extrabold">{p.source?.label ?? r.title}</span>
              </p>
              <PlayerStage item={cur} state={state} cassette={cassette} compact={compact} />
            </div>

            <div className={cn("w-full max-w-3xl", !sideBySide && "mt-4")}>
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <StatePill state={state} />
                  <Link href={`${albumHref}?t=${t.id}`} onClick={close}
                    className="mt-2.5 line-clamp-2 break-words font-rvm-display text-3xl font-black leading-[1.05] tracking-tight hover:underline sm:text-4xl lg:text-[44px]">
                    {t.title}
                  </Link>
                  {r.artist_id
                    ? <Link href={`/artist/${r.artist_id}`} onClick={close} className="mt-1.5 block truncate text-lg font-semibold hover:underline">{artistName(r)}</Link>
                    : <p className="mt-1.5 truncate text-lg font-semibold">{artistName(r)}</p>}
                  <p className="mt-0.5 truncate text-sm text-rvm-soft">
                    <Link href={albumHref} onClick={close} className="hover:text-rvm-text hover:underline">{r.title}</Link> · {releaseKindLabel(r.kind)}
                  </p>
                </div>
                {/* Favori : un rond vert profond, le cœur citron quand il est aimé (lisible sur le fond clair). */}
                <span className="rvm-deep mt-9 shrink-0 rounded-full shadow-lg shadow-rvm-deep/25">
                  <LikeButton track={t} size="h-6 w-6" className="h-12 w-12 hover:bg-white/10" />
                </span>
              </div>
              {p.preview ? (
                <p className="mt-4 rounded-xl border border-rvm-premium/40 bg-rvm-premium/10 px-3 py-2 text-sm text-rvm-soft">
                  Extrait de 30 s · titre réservé aux abonnés.{" "}
                  <Link href="/plus" onClick={close} className="font-bold text-rvm-text underline">Découvrir Rivendy+</Link>
                </p>
              ) : null}
              <Seek className="mt-4" large />
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <span aria-hidden />
                <Controls size="full" />
                <div className="hidden justify-end md:flex"><Volume large /></div>
              </div>
              {p.error ? <p role="alert" className="mt-4 text-center text-sm font-semibold text-red-700">{p.error}</p> : null}
            </div>
          </section>

          <aside aria-label="File d’attente"
            className="flex min-h-0 flex-col rounded-3xl border border-rvm-line bg-rvm-surface/90 p-4 shadow-[0_18px_44px_rgb(6_63_59/0.08)] backdrop-blur-sm lg:sticky lg:top-4 lg:h-[calc(100dvh-6rem)] lg:min-h-[420px] lg:self-start">
            <h2 className="px-2 font-rvm-display text-xl font-extrabold">File d’attente</h2>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain"><QueueList limit={50} /></div>
            {p.source?.href ? (
              <Link href={p.source.href} onClick={close}
                className="mt-3 flex items-center gap-3 rounded-xl border-t border-rvm-line px-2 pt-4 transition-colors hover:text-rvm-ink-accent">
                {fromAlbum
                  ? <Cover url={r.cover_url} size={160} alt="" className="h-14 w-14 shrink-0 shadow-md" rounded="rounded-lg" />
                  : <IconTile icon={ListMusic} className="h-14 w-14 shrink-0 rounded-lg shadow-none" />}
                <span className="min-w-0">
                  <span className="block truncate font-bold">{p.source.label}</span>
                  <span className="block truncate text-sm text-rvm-soft">{fromAlbum ? artistName(r) : "Voir la sélection"}</span>
                </span>
              </Link>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}

/** La platine (radio-cassette ou cassette compacte), ou la grande pochette hors « Mode cassette ». */
function PlayerStage({ item, state, cassette, compact }: { item: QueueItem; state: DeckState; cassette: boolean; compact: boolean }) {
  if (!cassette) {
    return (
      <div className="mt-4 w-[min(100%,420px,max(220px,calc(100dvh-460px)))]">
        <Cover url={item.release.cover_url} size={720} alt={`Pochette de ${item.release.title}`} priority
          className={cn("w-full shadow-2xl shadow-rvm-deep/30 ring-1 ring-rvm-text/10 transition-transform duration-500 motion-reduce:transition-none",
            state === "playing" ? "scale-100" : "scale-[0.97]")}
          rounded="rounded-3xl" />
      </div>
    );
  }
  return (
    // Largeur réglée sur la hauteur de la fenêtre : titre et commandes restent à l'écran.
    <div className={cn("relative mt-3", compact
      ? "w-[min(100%,380px,max(240px,calc((100dvh-150px)*1.4)))]"
      : "w-[min(100%,980px,max(420px,calc((100dvh-430px)*2.08)))]")}>
      <SoundWaves />
      <CassetteDeck item={item} state={state} compact={compact} />
    </div>
  );
}

/** État réel du lecteur, en toutes lettres (l'égaliseur ne bouge qu'en lecture). */
function StatePill({ state }: { state: DeckState }) {
  const label = state === "loading" ? "Chargement…" : state === "playing" ? "En lecture" : "En pause";
  return (
    <span className="inline-flex h-8 items-center gap-2 rounded-full bg-rvm-raised px-3 text-[13px] font-bold text-rvm-text">
      {state === "loading"
        ? <LoaderCircle className="h-4 w-4 text-rvm-ink-accent motion-safe:animate-spin" aria-hidden />
        : <Equalizer paused={state !== "playing"} />}
      {label}
    </span>
  );
}

/** Ondes et notes citron derrière la platine (décor, n'intercepte aucun clic). */
function SoundWaves() {
  return (
    <svg aria-hidden focusable="false" viewBox="0 0 1200 400" preserveAspectRatio="none"
      className="pointer-events-none absolute left-1/2 top-[6%] h-[72%] w-[min(118%,100vw)] -translate-x-1/2 text-rvm-accent opacity-70">
      <path d="M0 250 C 150 120, 300 330, 450 200 S 750 90, 900 210 S 1100 300, 1200 170" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M0 290 C 170 170, 320 360, 480 240 S 760 140, 920 250 S 1110 330, 1200 220" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="2" />
      <path d="M0 210 C 140 90, 290 290, 430 170 S 740 60, 880 180 S 1090 260, 1200 130" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" />
      <g transform="translate(90 70)"><Music2Glyph /></g>
      <g transform="translate(1080 150) scale(0.8)"><Music2Glyph /></g>
    </svg>
  );
}

function Music2Glyph() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="52" r="10" />
      <path d="M22 52 V8 L48 2 V40" />
      <circle cx="38" cy="42" r="10" />
    </g>
  );
}

/** Fond du lecteur : menthe, soleil doux et feuillages flous aux coins (décor). */
function PlayerBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="rvm-player-sky absolute inset-0" />
      <Foliage className="absolute -bottom-16 -left-16 h-80 w-80 rotate-12 opacity-60 blur-[2px]" />
      <Foliage className="absolute -left-20 top-24 h-64 w-64 -rotate-[24deg] opacity-35 blur-[3px]" />
      <Foliage className="absolute -right-24 top-1/3 h-72 w-72 rotate-[160deg] opacity-30 blur-[3px]" />
      <Music2 className="absolute left-[12%] top-[16%] h-8 w-8 -rotate-12 text-rvm-sun opacity-60" />
    </div>
  );
}

function Foliage({ className }: { className?: string }) {
  // Feuilles de palmier stylisées, dans les verts de la Musique.
  const leaf = "M0 0 C 30 -18 78 -14 110 8 C 78 22 32 22 0 0 Z";
  return (
    <svg viewBox="-20 -120 260 260" className={className}>
      {[-70, -40, -12, 16, 44].map((a, k) => (
        <path key={a} d={leaf} transform={`rotate(${a}) scale(${1 - k * 0.06})`} fill={k % 2 ? "var(--rvm-deep-2)" : "var(--rvm-eq)"} />
      ))}
    </svg>
  );
}
