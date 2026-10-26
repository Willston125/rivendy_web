"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Maximize, Minimize, PictureInPicture2, Play, SkipForward } from "lucide-react";
import type HlsType from "hls.js";
import { cn } from "@/lib/utils/cn";
import { QUALITIES, SPEEDS, parseRenditions, pickRendition, showSkipIntro, withBandwidthHint, type QualityId } from "../play-logic";

/**
 * Lecteur vidéo du site (Omnicanal lot C, §7.2) : balise <video> + hls.js
 * (version figée), HLS natif sur Safari sans MSE. Éco data par défaut, comme
 * l'app : hls.js plafonne la qualité (≤ 360p) ; en HLS natif, l'adresse reçoit
 * `clientBandwidthHint` (même méthode que l'app). Sous-titres Rivendy
 * (WebVTT), « Passer l'intro », « Épisode suivant », vitesse, plein écran,
 * image dans l'image, raccourcis clavier (espace/K, F, M, ← →).
 *
 * Le lecteur ne compte rien : il signale la lecture (onVideo), la fin
 * (onEnded) et les erreurs graves (onFatal). Le comptage vit dans WatchView.
 */

export type FatalReason = "auth" | "network" | "media";

const QUALITY_KEY = "rivendy_play_quality";

function savedQuality(): QualityId {
  try {
    const q = localStorage.getItem(QUALITY_KEY);
    if (q === "eco" || q === "standard" || q === "hd") return q;
  } catch { /* stockage fermé */ }
  return "eco";
}

const targetHeight = (q: QualityId): number | null => QUALITIES.find((x) => x.id === q)?.height ?? null;

/** Plafond hls.js : la plus haute variante ≤ hauteur visée, sinon la plus basse. */
const levelSize = (l: { width: number; height: number }) => Math.min(l.width || l.height, l.height || l.width);
function capLevels(hls: HlsType, q: QualityId): void {
  const target = targetHeight(q);
  if (target == null) { hls.autoLevelCapping = -1; return; }
  let best = -1;
  let lowest = -1;
  hls.levels.forEach((l, i) => {
    const d = levelSize(l);
    if (lowest < 0 || d < levelSize(hls.levels[lowest])) lowest = i;
    if (d > 0 && d <= target && (best < 0 || l.bitrate > hls.levels[best].bitrate)) best = i;
  });
  hls.autoLevelCapping = best >= 0 ? best : lowest;
}

/** HLS natif : l'adresse avec l'indice de débit de la variante visée. */
async function nativeSource(src: string, q: QualityId): Promise<string> {
  const target = targetHeight(q);
  if (target == null) return src;
  try {
    const master = await (await fetch(src)).text();
    const r = pickRendition(parseRenditions(master), target);
    return r ? withBandwidthHint(src, r.bandwidth) : src;
  } catch {
    return src;
  }
}

export function VideoPlayer({
  src, poster, startAt = 0, subtitles = [], intro, upNext, autoPlay = true, vertical = false,
  overlays = false, speedControl = true, endOverlay, title,
  onVideo, onEnded, onFatal,
}: {
  src: string;
  poster?: string | null;
  startAt?: number;
  subtitles?: Array<{ lang: string; url: string }>;
  intro?: { start: number | null | undefined; end: number | null | undefined } | null;
  /** « Épisode suivant » : visible à partir de `at` secondes. */
  upNext?: { at: number; label: string; onGo: () => void } | null;
  autoPlay?: boolean;
  vertical?: boolean;
  /**
   * Clips (2026-10-26) : chargement visible jusqu'à la première image,
   * attente du réseau signalée, et — si le navigateur refuse la lecture
   * automatique — une commande « Lancer la lecture » dans le lecteur. Le choix
   * de qualité n'apparaît que si la source en propose plusieurs. Faux par
   * défaut : films et épisodes gardent leur lecteur tel quel.
   */
  overlays?: boolean;
  /** Choix de la vitesse (inutile pour un clip musical). */
  speedControl?: boolean;
  /** Posé sur l'image à la fin de la vidéo (clips : « À suivre », « Revoir »). */
  endOverlay?: React.ReactNode;
  /** Nom de la vidéo pour les lecteurs d'écran. */
  title?: string;
  /** L'élément vidéo, une fois prêt (le comptage s'y abonne). */
  onVideo?: (v: HTMLVideoElement | null) => void;
  onEnded?: () => void;
  onFatal?: (reason: FatalReason) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<HlsType | null>(null);
  // Monté seulement dans le navigateur (après la demande de lecture) : le
  // stockage local se lit dès le premier rendu.
  const [quality, setQuality] = useState<QualityId>(savedQuality);
  const qualityRef = useRef<QualityId>(quality);
  const [speed, setSpeed] = useState(1);
  const [now, setNow] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [pipOk] = useState(() => typeof document !== "undefined" && !!document.pictureInPictureEnabled);
  // Mode « overlays » (clips) : première image pas encore affichée, attente
  // du réseau, lecture automatique refusée par le navigateur, fin.
  const [started, setStarted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [ended, setEnded] = useState(false);
  // Nombre de qualités de la source (hls.js) ; null = inconnu (HLS natif).
  const [levels, setLevels] = useState<number | null>(null);

  // Dernières valeurs des rappels et du point de départ, lues par les effets.
  const startRef = useRef(startAt);
  const autoRef = useRef(autoPlay);
  const overlaysRef = useRef(overlays);
  const cb = useRef({ onVideo, onEnded, onFatal });
  useEffect(() => {
    startRef.current = startAt;
    autoRef.current = autoPlay;
    overlaysRef.current = overlays;
    cb.current = { onVideo, onEnded, onFatal };
  });

  // Chargement de la source.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let netRetries = 0;
    let mediaRetries = 0;
    const begin = () => {
      if (startRef.current > 0) video.currentTime = startRef.current;
      if (autoRef.current) {
        void video.play().catch((e: unknown) => {
          // Lecture automatique refusée (règle du navigateur) : une commande claire dans le lecteur.
          if (overlaysRef.current && (e as { name?: string } | null)?.name === "NotAllowedError") setBlocked(true);
        });
      }
    };
    void (async () => {
      const { default: Hls } = await import("hls.js");
      if (cancelled) return;
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, startLevel: 0, maxBufferLength: 30 });
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, () => { setLevels(hls.levels.length); capLevels(hls, qualityRef.current); begin(); });
        hls.on(Hls.Events.ERROR, (_e, d) => {
          if (!d.fatal) return;
          if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
            const code = d.response?.code;
            if (code === 401 || code === 403) { cb.current.onFatal?.("auth"); return; }
            if (netRetries++ < 2) { hls.startLoad(); return; }
            cb.current.onFatal?.("network");
          } else if (d.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries++ < 1) {
            hls.recoverMediaError();
          } else {
            cb.current.onFatal?.("media");
          }
        });
        hls.loadSource(src);
        hls.attachMedia(video);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        const url = await nativeSource(src, qualityRef.current);
        if (cancelled) return;
        video.addEventListener("loadedmetadata", begin, { once: true });
        video.src = url;
      } else {
        cb.current.onFatal?.("media");
      }
      cb.current.onVideo?.(video);
    })();
    return () => {
      cancelled = true;
      cb.current.onVideo?.(null);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  // Changement de qualité pendant la lecture.
  const chooseQuality = async (q: QualityId) => {
    setQuality(q);
    qualityRef.current = q;
    try { localStorage.setItem(QUALITY_KEY, q); } catch { /* stockage fermé */ }
    const video = videoRef.current;
    if (hlsRef.current) { capLevels(hlsRef.current, q); return; }
    if (!video || !video.src) return;
    const at = video.currentTime;
    const playing = !video.paused;
    const url = await nativeSource(src, q);
    video.addEventListener("loadedmetadata", () => {
      video.currentTime = at;
      if (playing) void video.play().catch(() => undefined);
    }, { once: true });
    video.src = url;
  };

  // Horloge d'affichage (« Passer l'intro », « Épisode suivant ») et fin.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => setNow(video.currentTime);
    const onEnd = () => { setEnded(true); cb.current.onEnded?.(); };
    // Mode « overlays » : chargement jusqu'à la première image, attente du réseau ensuite.
    const onPlaying = () => { setStarted(true); setBuffering(false); setBlocked(false); setEnded(false); };
    const onWaiting = () => setBuffering(true);
    const onPlay = () => { setBlocked(false); setEnded(false); };
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("ended", onEnd);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("play", onPlay);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("ended", onEnd);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("play", onPlay);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void wrapRef.current?.requestFullscreen().catch(() => undefined);
  };
  const togglePip = () => {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) void document.exitPictureInPicture().catch(() => undefined);
    else void v.requestPictureInPicture().catch(() => undefined);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const v = videoRef.current;
    if (!v || (e.target as HTMLElement).tagName === "SELECT") return;
    const k = e.key.toLowerCase();
    if (k === " " || k === "k") { e.preventDefault(); if (v.paused) void v.play().catch(() => undefined); else v.pause(); }
    else if (k === "f") { e.preventDefault(); toggleFullscreen(); }
    else if (k === "m") { e.preventDefault(); v.muted = !v.muted; }
    else if (k === "arrowright") { e.preventDefault(); v.currentTime = Math.min(v.duration || Infinity, v.currentTime + 10); }
    else if (k === "arrowleft") { e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 10); }
  };

  const skipIntro = intro ? showSkipIntro(now, intro.start, intro.end) : false;
  const showNext = !!upNext && now > 0 && now >= upNext.at;

  return (
    <div ref={wrapRef} tabIndex={0} onKeyDown={onKey}
      className={cn("flex flex-col overflow-hidden bg-black outline-none", fullscreen ? "h-screen w-screen" : "rounded-2xl")}>
      <div className={cn("relative bg-black", fullscreen ? "min-h-0 flex-1" : vertical ? "mx-auto aspect-[9/16] w-full max-w-sm" : "aspect-video w-full")}>
        <video ref={videoRef} controls playsInline crossOrigin="anonymous" controlsList="nodownload nofullscreen"
          disablePictureInPicture={!pipOk} poster={poster ?? undefined} aria-label={title}
          onDoubleClick={toggleFullscreen} onContextMenu={(e) => e.preventDefault()}
          className="absolute inset-0 h-full w-full bg-black object-contain">
          {subtitles.map((s) => (
            <track key={s.url} kind="subtitles" src={s.url} srcLang={s.lang} label={s.lang.toUpperCase()} />
          ))}
        </video>
        {skipIntro ? (
          <button type="button" onClick={() => { const v = videoRef.current; if (v && intro?.end) v.currentTime = intro.end; }}
            className="absolute bottom-16 right-4 h-11 rounded-lg border border-white/40 bg-black/70 px-4 text-sm font-bold text-white hover:bg-black/90">
            Passer l’intro
          </button>
        ) : null}
        {showNext && upNext ? (
          <button type="button" onClick={upNext.onGo}
            className="absolute bottom-16 right-4 flex h-11 items-center gap-2 rounded-lg bg-rvp-accent px-4 text-sm font-bold text-rvp-on-accent hover:bg-rvp-accent-hover">
            <SkipForward className="h-4 w-4" /> {upNext.label}
          </button>
        ) : null}
        {overlays && blocked ? (
          // Le navigateur exige un geste : la commande est DANS le lecteur, jamais une autre page.
          <div className="absolute inset-0 grid place-items-center bg-black/45">
            <button type="button"
              onClick={() => { const v = videoRef.current; if (v) void v.play().then(() => setBlocked(false)).catch(() => undefined); }}
              className="flex flex-col items-center gap-3 rounded-2xl px-6 py-4 text-white">
              <span className="grid h-20 w-20 place-items-center rounded-full bg-rvp-accent text-rvp-on-accent shadow-rvp-cta motion-safe:transition-transform motion-safe:hover:scale-105">
                <Play className="h-9 w-9 translate-x-0.5 fill-current" aria-hidden />
              </span>
              <span className="text-[15px] font-semibold drop-shadow">Lancer la lecture</span>
            </button>
          </div>
        ) : overlays && !ended && (!started || buffering) ? (
          <div role="status" className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="flex flex-col items-center gap-3 text-white">
              <Loader2 className="h-11 w-11 animate-spin text-rvp-accent motion-reduce:animate-none" aria-hidden />
              <span className="rounded-md bg-black/55 px-2 py-0.5 text-[13px] font-semibold">{started ? "Chargement…" : "Démarrage du clip…"}</span>
            </span>
          </div>
        ) : null}
        {overlays && ended && endOverlay ? <div className="absolute inset-0">{endOverlay}</div> : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-rvp-surface px-3 py-2 text-xs text-rvp-soft">
        {/* Clips : la qualité seulement si la source en propose plusieurs (HLS natif : inconnu, gardée). */}
        {!overlays || levels == null || levels > 1 ? (
          <label className="flex items-center gap-1">
            Qualité
            <select value={quality} onChange={(e) => void chooseQuality(e.target.value as QualityId)}
              className="h-9 rounded-md bg-rvp-raised px-2 text-rvp-text">
              {QUALITIES.map((q) => <option key={q.id} value={q.id} className="bg-rvp-surface">{q.label}</option>)}
            </select>
          </label>
        ) : null}
        {speedControl ? (
          <label className="flex items-center gap-1">
            Vitesse
            <select value={speed} onChange={(e) => { const r = Number(e.target.value); setSpeed(r); if (videoRef.current) videoRef.current.playbackRate = r; }}
              className="h-9 rounded-md bg-rvp-raised px-2 text-rvp-text">
              {SPEEDS.map((s) => <option key={s} value={s} className="bg-rvp-surface">{s === 1 ? "Normale" : `${String(s).replace(".", ",")}×`}</option>)}
            </select>
          </label>
        ) : null}
        {subtitles.length > 0 ? <span className="text-rvp-muted">Sous-titres : menu du lecteur</span> : null}
        <span className="flex-1" />
        {pipOk ? (
          <button type="button" onClick={togglePip} className="flex h-10 w-10 items-center justify-center rounded-lg text-rvp-text hover:bg-white/10" aria-label="Image dans l’image">
            <PictureInPicture2 className="h-4 w-4" />
          </button>
        ) : null}
        <button type="button" onClick={toggleFullscreen} className="flex h-10 w-10 items-center justify-center rounded-lg text-rvp-text hover:bg-white/10" aria-label={fullscreen ? "Quitter le plein écran" : "Plein écran"}>
          {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
