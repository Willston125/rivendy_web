"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown, ListMusic, LoaderCircle, Maximize2, PanelRight, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack,
  SkipForward, Volume1, Volume2, VolumeX, X,
} from "lucide-react";
import { isMusicPath } from "@/components/layout/hide-in-music";
import { cn } from "@/lib/utils/cn";
import { useMusicLayoutOptional } from "../music-layout";
import { artistName, formatPlayerTime, playerDuration, thumbUrl } from "../music-logic";
import { Cover, LikeButton, QueueList, TrackMenuButton, iconButton } from "../music-ui";
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
  const shown = !!cur && !inMusic;

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
  if (!cur) return null;

  return (
    <>
      <div aria-hidden className="h-[calc(var(--rvm-player-h,76px)+8px)]" />
      <section ref={bar} aria-label="Lecteur Rivendy Musique"
        className="rvm-scope fixed inset-x-0 bottom-0 z-[45] border-t border-rvm-line bg-rvm-panel/95 pb-[env(safe-area-inset-bottom)] text-rvm-text shadow-[0_-8px_30px_rgba(0,0,0,0.35)] backdrop-blur-md">
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
              className={cn(iconButton, queueOpen && "text-rvm-accent hover:text-rvm-accent")}>
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
        className="rvm-scope hidden h-20 shrink-0 grid-cols-[minmax(180px,1fr)_minmax(0,1.6fr)_minmax(180px,1fr)] items-center gap-4 px-4 text-rvm-text md:grid">
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
            title="En cours de lecture" className={cn(iconButton, nowOpen && "text-rvm-accent hover:text-rvm-accent")}>
            <PanelRight className="h-5 w-5" aria-hidden />
          </button>
          <button type="button" onClick={layout?.toggleQueue} disabled={!cur} aria-pressed={queueOpen}
            aria-label={queueOpen ? "Masquer la file d’attente" : "Afficher la file d’attente"}
            title="File d’attente" className={cn(iconButton, queueOpen && "text-rvm-accent hover:text-rvm-accent")}>
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
    <section aria-label="Lecteur Rivendy Musique" className="rvm-scope relative mx-2 mb-1 overflow-hidden rounded-md bg-rvm-raised text-rvm-text shadow-lg shadow-black/40 md:hidden">
      <div className="flex h-14 items-center gap-2.5 pl-2 pr-1">
        <button type="button" onClick={() => p.setExpanded(true)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          aria-label={`Agrandir le lecteur : ${t.title}, ${artistName(r)}`}>
          <Cover url={r.cover_url} size={160} alt="" className="h-10 w-10 shrink-0" rounded="rounded" />
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold">{t.title}</span>
            <span className="block truncate text-[13px] text-rvm-soft">{artistName(r)}</span>
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
        {r.artist_id
          ? <Link href={`/artist/${r.artist_id}`} className="block truncate text-[13px] text-rvm-soft hover:text-rvm-text hover:underline">{artistName(r)}</Link>
          : <span className="block truncate text-[13px] text-rvm-soft">{artistName(r)}</span>}
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
        className={cn(iconButton, p.shuffled && "text-rvm-accent hover:text-rvm-accent")}>
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
        className={cn(iconButton, p.repeat !== "off" && "text-rvm-accent hover:text-rvm-accent")}>
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
function Seek({ className }: { className?: string }) {
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
        className="rvm-range min-w-0 flex-1" />
      <span className="w-10" title={ready ? undefined : "Durée du titre (fichier pas encore chargé)"}>{p.current ? formatPlayerTime(total) : "–:––"}</span>
    </div>
  );
}

function MobileProgress({ inside = false }: { inside?: boolean }) {
  const { position, total } = useShownDuration();
  const pct = total ? Math.min(100, (position / total) * 100) : 0;
  return (
    <div role="progressbar" aria-label="Progression du titre" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
      className={cn("bg-white/10 md:hidden", inside ? "absolute inset-x-2 bottom-0 h-[2px]" : "h-[3px]")}>
      <div className="h-full bg-rvm-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Volume() {
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
        className="rvm-range hidden w-24 lg:block" />
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

/** Vue agrandie : grande pochette, commandes, volume, file d'attente (téléphone compris). */
function FullPlayer() {
  const p = useMusicPlayer();
  const cur = p.current;
  const reduce = useRef<HTMLButtonElement>(null);
  const { setExpanded } = p;
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
  const bg = thumbUrl(r.cover_url, 480);

  return (
    <div role="dialog" aria-modal="true" aria-label="Lecteur agrandi" className="rvm-scope fixed inset-0 z-[55] overflow-y-auto bg-rvm-ground text-rvm-text">
      <div aria-hidden className="pointer-events-none fixed inset-0">
        {bg && bg.startsWith("https://") ? <Image src={bg} alt="" fill unoptimized sizes="100vw" className="scale-125 object-cover opacity-30 blur-3xl" /> : null}
        <div className="absolute inset-0 bg-gradient-to-b from-rvm-ground/40 via-rvm-ground/85 to-rvm-ground" />
      </div>
      <div className="relative mx-auto grid min-h-full max-w-6xl gap-10 px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8">
        <div className="flex flex-col">
          <div className="flex items-center justify-between">
            <button ref={reduce} type="button" onClick={() => p.setExpanded(false)} className="inline-flex h-10 items-center gap-1 rounded-full px-2 text-sm text-rvm-soft hover:text-rvm-text">
              <ChevronDown className="h-5 w-5" aria-hidden /> Réduire
            </button>
            {p.source ? <p className="min-w-0 truncate px-2 text-sm font-semibold text-rvm-soft">{p.source.label}</p> : null}
            <TrackMenuButton item={cur} onOpenPage={() => p.setExpanded(false)} />
          </div>
          <div className="mx-auto mt-6 w-full max-w-[min(420px,80vw)] lg:mt-10">
            <Cover url={r.cover_url} size={720} alt={`Pochette de ${r.title}`} priority
              className={cn("w-full shadow-2xl shadow-black/60 ring-1 ring-white/10 transition-transform duration-500 motion-reduce:transition-none", p.playing ? "scale-100" : "scale-95")}
              rounded="rounded-3xl" />
          </div>
          <div className="mx-auto mt-8 w-full max-w-xl">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <Link href={`/music/album/${r.id}?t=${t.id}`} onClick={() => p.setExpanded(false)} className="block truncate text-2xl font-black hover:underline sm:text-3xl">{t.title}</Link>
                {r.artist_id
                  ? <Link href={`/artist/${r.artist_id}`} onClick={() => p.setExpanded(false)} className="mt-1 block truncate text-rvm-soft hover:underline">{artistName(r)}</Link>
                  : <p className="mt-1 truncate text-rvm-soft">{artistName(r)}</p>}
              </div>
              <LikeButton track={t} size="h-6 w-6" className="h-12 w-12" />
            </div>
            {p.preview ? (
              <p className="mt-4 rounded-xl border border-rvm-premium/40 bg-rvm-premium/10 px-3 py-2 text-sm text-rvm-soft">
                Extrait de 30 s · titre réservé aux abonnés.{" "}
                <Link href="/plus" onClick={() => p.setExpanded(false)} className="font-bold text-rvm-premium underline">Découvrir Rivendy+</Link>
              </p>
            ) : null}
            <Seek className="mt-6" />
            <div className="mt-4 flex justify-center"><Controls size="full" /></div>
            <div className="mt-5 hidden justify-center md:flex"><Volume /></div>
            {p.error ? <p role="alert" className="mt-4 text-center text-sm text-red-300">{p.error}</p> : null}
          </div>
        </div>
        <section aria-label="File d’attente" className="lg:mt-14 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:rounded-2xl lg:border lg:border-rvm-line lg:bg-rvm-panel/70 lg:p-3">
          <h2 className="mb-3 px-2 text-lg font-bold">File d’attente</h2>
          <QueueList limit={50} />
        </section>
      </div>
    </div>
  );
}
