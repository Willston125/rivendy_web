"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { useDialogs } from "@/features/ui/dialogs";
import { MEDIA_PLAY_EVENT, deviceId } from "@/features/media/device-id";
import {
  countPlay, fetchStreamGrant, listenProgress, playbackClose, playbackPing, type StreamGrant,
} from "../music-api";
import {
  SKIPPABLE_STREAM_ERRORS, addListened, artistName, grantStillUsable, isPlayable, nextIndex, nextRepeat,
  previousAction, shouldCount, shouldPrefetchNext, shuffleKeepingCurrent, streamErrorMessage, thumbUrl,
  type MusicRelease, type MusicTrack, type RepeatMode,
} from "../music-logic";
import { loginHref, savePending } from "../music-pending";

/**
 * Lecteur Rivendy Music du site (Omnicanal lot D, 2026-10-21) : UN élément
 * <audio> pour tout le site, monté à la racine (app/providers.tsx) — la
 * navigation interne ne coupe pas le son. Mêmes règles que l'app 1.4.9 :
 * lien signé demandé à `musique-stream-url` (le serveur décide extrait ou
 * titre entier), écoute comptée après 30 s réelles (`music_count_play`), temps
 * crédité et signe de vie de l'écran toutes les 60 s (`music_listen_progress`,
 * `playback_ping`), écran libéré à la fin (`playback_close`).
 */

export type QueueItem = { track: MusicTrack; release: MusicRelease };

/** D'où vient la file (panneau « En cours de lecture ») : « Titres likés », un album, le Hit… */
export type PlaySource = { label: string; href?: string | null };
export type PlayOptions = { source?: PlaySource | null; shuffle?: boolean };

type PlayerContext = {
  queue: QueueItem[];
  index: number;
  current: QueueItem | null;
  playing: boolean;
  loading: boolean;
  duration: number;
  preview: boolean;
  repeat: RepeatMode;
  shuffled: boolean;
  volume: number;
  muted: boolean;
  expanded: boolean;
  error: string | null;
  /** Sélection d'où vient la file en cours (null : inconnue). */
  source: PlaySource | null;
  playQueue: (items: QueueItem[], start?: number, options?: PlayOptions) => void;
  /** Joue l'élément i de la file en cours (file d'attente, « À suivre »). */
  playAt: (i: number) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  playNext: (item: QueueItem) => void;
  addToQueue: (item: QueueItem) => void;
  removeAt: (i: number) => void;
  /** Vide « À suivre » (le titre en cours continue). */
  clearUpcoming: () => void;
  close: () => void;
  setExpanded: (open: boolean) => void;
  pause: () => void;
};

const Ctx = createContext<PlayerContext | null>(null);
/**
 * Position de lecture à part (refonte du 2026-10-22) : elle change plusieurs
 * fois par seconde ; seules les barres de progression la lisent, les listes
 * de titres ne se redessinent plus à chaque instant.
 */
type Progress = {
  position: number;
  /** Durée connue : celle du fichier si `ready`, sinon celle du titre en base (ou 0). */
  duration: number;
  /** Le fichier du titre en cours est chargé (métadonnées lues) : on peut s'y déplacer. */
  ready: boolean;
};
const ProgressCtx = createContext<Progress>({ position: 0, duration: 0, ready: false });

const STORE_KEY = "rivendy_music_queue_v1";
/** Volume et son coupé : un confort du navigateur, jamais envoyé au serveur. */
const VOLUME_KEY = "rivendy_music_volume_v1";

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const { country } = useCountry();
  const dialogs = useDialogs();
  const router = useRouter();
  const pathname = usePathname();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [shuffled, setShuffled] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<PlaySource | null>(null);

  // État de l'écoute en cours (lu dans les gestionnaires, jamais au rendu).
  const listen = useRef({ trackId: "", listened: 0, lastPos: 0, counted: false, sessionId: null as string | null });
  const grants = useRef(new Map<string, { grant: StreamGrant; fetchedAt: number }>());
  const failures = useRef(0);
  const originalOrder = useRef<QueueItem[] | null>(null);
  const tokenRef = useRef<string | null>(null);
  const marketRef = useRef<string | null>(null);
  const loadSeq = useRef(0);
  const queueRef = useRef<QueueItem[]>([]);
  const indexRef = useRef(0);
  const repeatRef = useRef<RepeatMode>("off");
  // loadAt se relance elle-même (titre suivant, écran repris) : par une référence.
  const loadAtRef = useRef<(items: QueueItem[], i: number, takeOver?: boolean) => Promise<void>>(async () => {});

  useEffect(() => { tokenRef.current = session?.access_token ?? null; }, [session?.access_token]);
  useEffect(() => { marketRef.current = country?.id ?? null; }, [country?.id]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { indexRef.current = index; }, [index]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);

  // ── Fin d'une écoute : temps crédité et écran libéré ─────────────────────
  const finishListen = useCallback((keepalive = false) => {
    const l = listen.current;
    if (!l.trackId) return;
    const sessionId = l.sessionId;
    const credit = l.counted ? l.listened : 0;
    const trackId = l.trackId;
    listen.current = { trackId: "", listened: 0, lastPos: 0, counted: false, sessionId: null };
    if (!keepalive) {
      if (credit > 0) void listenProgress(trackId, credit);
      if (sessionId) void playbackClose(sessionId);
      return;
    }
    // Fermeture de l'onglet : requêtes « keepalive » (supabase-js ne le permet pas).
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const token = tokenRef.current;
    if (!base || !key || !token) return;
    const send = (fn: string, body: Record<string, unknown>) => {
      try {
        void fetch(`${base}/rest/v1/rpc/${fn}`, {
          method: "POST", keepalive: true,
          headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
      } catch { /* au mieux */ }
    };
    if (credit > 0) send("music_listen_progress", { p_track: trackId, p_seconds: Math.round(credit) });
    if (sessionId) send("playback_close", { p_session: sessionId });
  }, []);

  // ── Lien signé (réutilisé tant qu'il est valable) ────────────────────────
  const grantFor = useCallback(async (trackId: string, takeOver = false) => {
    const kept = grants.current.get(trackId);
    const now = Date.now();
    if (!takeOver && kept && grantStillUsable(kept.fetchedAt, new Date(kept.grant.expires_at).getTime(), now)) {
      return { ok: true as const, grant: kept.grant };
    }
    const res = await fetchStreamGrant(trackId, deviceId(), takeOver);
    if (res.ok) grants.current.set(trackId, { grant: res.grant, fetchedAt: now });
    return res;
  }, []);

  // ── Charger et lire l'élément i de la file ───────────────────────────────
  const loadAt = useCallback(async (items: QueueItem[], i: number, takeOver = false) => {
    const audio = audioRef.current;
    const item = items[i];
    if (!audio || !item) return;
    finishListen();
    const seq = ++loadSeq.current;
    setIndex(i);
    setLoading(true);
    setError(null);
    setPosition(0);
    setReady(false);
    setDuration(Number(item.track.duration_seconds ?? 0));
    const res = await grantFor(item.track.id, takeOver);
    if (seq !== loadSeq.current) return; // un autre titre a été demandé entre-temps
    if (!res.ok) {
      setLoading(false);
      if (res.error === "too_many_streams") {
        const ok = await dialogs.confirm({
          title: "Rivendy+ est déjà utilisé sur deux écrans",
          message: "Écouter ici arrête la lecture sur l’écran le plus ancien.",
          confirmLabel: "Écouter ici",
        });
        if (ok) void loadAtRef.current(items, i, true);
        return;
      }
      if (res.error === "not_authenticated") {
        setPlaying(false);
        savePending({ kind: "play", id: item.track.id, path: pathname || "/music", label: item.track.title }, items.slice(i));
        router.push(loginHref(pathname || "/music"));
        return;
      }
      if (SKIPPABLE_STREAM_ERRORS.has(res.error) && failures.current < 5) {
        failures.current += 1;
        const n = nextIndex(i, items.length, "off");
        if (n !== null) { void loadAtRef.current(items, n); return; }
      }
      failures.current = 0;
      setPlaying(false);
      setError(streamErrorMessage(res.error));
      dialogs.notify(streamErrorMessage(res.error), "error");
      return;
    }
    failures.current = 0;
    const g = res.grant;
    listen.current = { trackId: item.track.id, listened: 0, lastPos: 0, counted: false, sessionId: g.playback_session_id };
    setPreview(!!g.preview);
    audio.src = g.url;
    try {
      await audio.play();
      window.dispatchEvent(new CustomEvent(MEDIA_PLAY_EVENT, { detail: "music" }));
    } catch {
      setPlaying(false);
    }
    setLoading(false);
  }, [dialogs, finishListen, grantFor, pathname, router]);
  useEffect(() => { loadAtRef.current = loadAt; }, [loadAt]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const playQueue = useCallback((items: QueueItem[], start = 0, options?: PlayOptions) => {
    const playable = items.filter((x) => isPlayable(x.track));
    if (playable.length === 0) { dialogs.notify("Aucun titre disponible pour l’instant.", "info"); return; }
    const startId = items[start]?.track.id;
    // Lecture aléatoire d'une liste : un premier titre au hasard, le reste mélangé.
    const i = options?.shuffle
      ? Math.floor(Math.random() * playable.length)
      : Math.max(0, playable.findIndex((x) => x.track.id === startId));
    if (!user) {
      // Écouter exige un compte : la file est gardée, la page d'origine
      // propose de la reprendre après la connexion (un geste reste requis).
      const first = playable[i];
      savePending({ kind: "play", id: first.track.id, path: pathname || "/music", label: first.track.title }, playable.slice(i));
      router.push(loginHref(pathname || "/music"));
      return;
    }
    setSource(options?.source ?? null);
    if (options?.shuffle) {
      const mixed = shuffleKeepingCurrent(playable, i);
      originalOrder.current = playable;
      setShuffled(true);
      setQueue(mixed);
      void loadAt(mixed, 0);
      return;
    }
    originalOrder.current = null;
    setShuffled(false);
    setQueue(playable);
    void loadAt(playable, i);
  }, [dialogs, loadAt, pathname, router, user]);

  const playAt = useCallback((i: number) => {
    if (i < 0 || i >= queueRef.current.length) return;
    void loadAt(queueRef.current, i);
  }, [loadAt]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.src && queueRef.current.length) { void loadAt(queueRef.current, indexRef.current); return; }
    if (audio.paused) {
      void audio.play().then(() => window.dispatchEvent(new CustomEvent(MEDIA_PLAY_EVENT, { detail: "music" }))).catch(() => {});
    } else audio.pause();
  }, [loadAt]);

  const pause = useCallback(() => { audioRef.current?.pause(); }, []);

  const next = useCallback(() => {
    const n = nextIndex(indexRef.current, queueRef.current.length, repeatRef.current === "one" ? "all" : repeatRef.current);
    if (n !== null) void loadAt(queueRef.current, n);
  }, [loadAt]);

  const previous = useCallback(() => {
    const audio = audioRef.current;
    const p = previousAction(indexRef.current, audio?.currentTime ?? 0);
    if (p.restart) {
      if (audio) audio.currentTime = 0;
      // Reprendre le titre = une nouvelle écoute (comme l'app).
      finishListen();
      const cur = queueRef.current[indexRef.current];
      if (cur) void loadAt(queueRef.current, indexRef.current);
      return;
    }
    void loadAt(queueRef.current, p.index);
  }, [finishListen, loadAt]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    audio.currentTime = Math.max(0, seconds);
    listen.current.lastPos = audio.currentTime; // un saut ne compte pas comme de l'écoute
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    if (audioRef.current) {
      audioRef.current.volume = clamped;
      if (clamped > 0) audioRef.current.muted = false;
    }
    setVolumeState(clamped);
    if (clamped > 0) setMuted(false);
    try { localStorage.setItem(VOLUME_KEY, JSON.stringify({ v: clamped, m: false })); } catch { /* rien */ }
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    setMuted((m) => {
      const next = !m;
      if (audio) audio.muted = next;
      try { localStorage.setItem(VOLUME_KEY, JSON.stringify({ v: audio?.volume ?? 1, m: next })); } catch { /* rien */ }
      return next;
    });
  }, []);

  // Volume du navigateur retrouvé à l'ouverture du site.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(VOLUME_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { v?: number; m?: boolean };
      const v = typeof saved.v === "number" && saved.v >= 0 && saved.v <= 1 ? saved.v : 1;
      if (audioRef.current) { audioRef.current.volume = v; audioRef.current.muted = !!saved.m; }
      setVolumeState(v);
      setMuted(!!saved.m);
    } catch { /* stockage indisponible */ }
  }, []);

  const cycleRepeat = useCallback(() => setRepeat((m) => nextRepeat(m)), []);

  const toggleShuffle = useCallback(() => {
    const q = queueRef.current;
    const i = indexRef.current;
    if (!shuffled) {
      originalOrder.current = q;
      setQueue(shuffleKeepingCurrent(q, i));
      setIndex(0);
      setShuffled(true);
    } else {
      const orig = originalOrder.current ?? q;
      const curId = q[i]?.track.id;
      setQueue(orig);
      setIndex(Math.max(0, orig.findIndex((x) => x.track.id === curId)));
      originalOrder.current = null;
      setShuffled(false);
    }
  }, [shuffled]);

  const playNext = useCallback((item: QueueItem) => {
    if (!isPlayable(item.track)) return;
    if (queueRef.current.length === 0) { playQueue([item]); return; }
    setQueue((q) => [...q.slice(0, indexRef.current + 1), item, ...q.slice(indexRef.current + 1)]);
    dialogs.notify("Lu juste après", "success");
  }, [dialogs, playQueue]);

  const addToQueue = useCallback((item: QueueItem) => {
    if (!isPlayable(item.track)) return;
    if (queueRef.current.length === 0) { playQueue([item]); return; }
    setQueue((q) => [...q, item]);
    dialogs.notify("Ajouté à la file d’attente", "success");
  }, [dialogs, playQueue]);

  const removeAt = useCallback((i: number) => {
    if (i === indexRef.current) return;
    setQueue((q) => q.filter((_, k) => k !== i));
    if (i < indexRef.current) setIndex((x) => x - 1);
  }, []);

  const clearUpcoming = useCallback(() => {
    setQueue((q) => q.slice(0, indexRef.current + 1));
    originalOrder.current = null;
  }, []);

  const close = useCallback(() => {
    const audio = audioRef.current;
    finishListen();
    if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); }
    setReady(false);
    setPosition(0);
    setDuration(0);
    loadSeq.current += 1;
    setQueue([]);
    setIndex(0);
    setPlaying(false);
    setExpanded(false);
    setPreview(false);
    setSource(null);
    try { localStorage.removeItem(STORE_KEY); } catch { /* rien */ }
  }, [finishListen]);

  // ── Événements de l'élément audio ────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      const pos = audio.currentTime;
      setPosition(pos);
      const l = listen.current;
      if (!l.trackId || audio.paused) { l.lastPos = pos; return; }
      l.listened = addListened(l.listened, l.lastPos, pos);
      l.lastPos = pos;
      const item = queueRef.current[indexRef.current];
      const dur = Number.isFinite(audio.duration) ? audio.duration : Number(item?.track.duration_seconds ?? 0);
      const isPreview = !!grants.current.get(l.trackId)?.grant.preview;
      if (shouldCount({ listened: l.listened, duration: dur, preview: isPreview, counted: l.counted })) {
        l.counted = true;
        void countPlay(l.trackId, marketRef.current, l.listened);
      }
      if (shouldPrefetchNext(pos, dur)) {
        const n = nextIndex(indexRef.current, queueRef.current.length, repeatRef.current);
        const nextItem = n !== null ? queueRef.current[n] : null;
        if (nextItem && nextItem.track.id !== l.trackId && !grants.current.has(nextItem.track.id)) {
          void grantFor(nextItem.track.id);
        }
      }
    };
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) { setDuration(audio.duration); setReady(true); }
    };
    const onPlay = () => setPlaying(true);
    // Pause pendant un chargement (« waiting ») : « playing » ne viendra pas, la roue s'arrête ici.
    const onPause = () => { setPlaying(false); setLoading(false); };
    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onEnded = () => {
      if (repeatRef.current === "one") { void loadAt(queueRef.current, indexRef.current); return; }
      const n = nextIndex(indexRef.current, queueRef.current.length, repeatRef.current);
      if (n === null) { finishListen(); setPlaying(false); return; }
      void loadAt(queueRef.current, n);
    };
    const onError = () => {
      // Lien expiré ou réseau : un nouvel essai avec un lien neuf, à la même position.
      const l = listen.current;
      if (!l.trackId) return;
      const at = audio.currentTime;
      grants.current.delete(l.trackId);
      void (async () => {
        const res = await grantFor(l.trackId);
        if (!res.ok) { setError(streamErrorMessage(res.error)); setPlaying(false); return; }
        audio.src = res.grant.url;
        audio.currentTime = at;
        listen.current.lastPos = at;
        void audio.play().catch(() => {});
      })();
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [finishListen, grantFor, loadAt]);

  // ── Toutes les 60 s : temps crédité et signe de vie de l'écran ───────────
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const l = listen.current;
      if (!l.trackId) return;
      if (l.counted) void listenProgress(l.trackId, l.listened);
      if (l.sessionId) {
        void playbackPing(l.sessionId).then((status) => {
          if (status && status !== "ok" && status !== "not_authenticated") {
            audioRef.current?.pause();
            dialogs.notify(status === "taken_over"
              ? "La lecture a repris sur un autre écran."
              : "La lecture s’est arrêtée : relancez le titre.", "info");
            listen.current.sessionId = null;
          }
        });
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [dialogs, playing]);

  // ── Une vidéo démarre : la musique se met en pause ───────────────────────
  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent).detail !== "music") audioRef.current?.pause();
    };
    window.addEventListener(MEDIA_PLAY_EVENT, onOther);
    return () => window.removeEventListener(MEDIA_PLAY_EVENT, onOther);
  }, []);

  // ── Fermeture de l'onglet ────────────────────────────────────────────────
  useEffect(() => {
    const onHide = () => finishListen(true);
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [finishListen]);

  // ── Déconnexion : on s'arrête ; changement de compte : file oubliée ──────
  useEffect(() => {
    if (!user) {
      grants.current.clear();
      const audio = audioRef.current;
      if (audio && audio.src) { audio.pause(); }
    }
  }, [user]);

  // ── File gardée dans le navigateur (confort ; l'historique est sur le serveur) ──
  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { u?: string; q?: QueueItem[]; i?: number; s?: PlaySource | null };
      if (saved.u !== user.id || !Array.isArray(saved.q) || saved.q.length === 0) return;
      setQueue(saved.q.slice(0, 50));
      if (saved.s && typeof saved.s.label === "string") setSource({ label: saved.s.label.slice(0, 120), href: typeof saved.s.href === "string" && saved.s.href.startsWith("/") ? saved.s.href : null });
      setIndex(Math.min(Math.max(0, saved.i ?? 0), saved.q.length - 1));
    } catch { /* stockage indisponible */ }
  }, [user]);

  useEffect(() => {
    if (!user || queue.length === 0) return;
    try {
      const start = Math.max(0, index - 10);
      localStorage.setItem(STORE_KEY, JSON.stringify({ u: user.id, q: queue.slice(start, start + 50), i: index - start, s: source }));
    } catch { /* stockage indisponible */ }
  }, [user, queue, index, source]);

  // ── Commandes de l'écran verrouillé et des touches multimédia ────────────
  const current = queue[index] ?? null;
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator) || !current) return;
    const cover = thumbUrl(current.release.cover_url, 480);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.track.title,
      artist: artistName(current.release),
      album: current.release.title,
      artwork: cover ? [{ src: cover, sizes: "480x480", type: "image/jpeg" }] : [],
    });
    navigator.mediaSession.setActionHandler("play", () => toggle());
    navigator.mediaSession.setActionHandler("pause", () => audioRef.current?.pause());
    navigator.mediaSession.setActionHandler("nexttrack", () => next());
    navigator.mediaSession.setActionHandler("previoustrack", () => previous());
    navigator.mediaSession.setActionHandler("seekto", (d) => { if (d.seekTime != null) seek(d.seekTime); });
  }, [current, next, previous, seek, toggle]);

  const value = useMemo<PlayerContext>(() => ({
    queue, index, current, playing, loading, duration, preview, repeat, shuffled, volume, muted, expanded, error, source,
    playQueue, playAt, toggle, next, previous, seek, setVolume, toggleMute, cycleRepeat, toggleShuffle, playNext, addToQueue,
    removeAt, clearUpcoming, close, setExpanded, pause,
  }), [queue, index, current, playing, loading, duration, preview, repeat, shuffled, volume, muted, expanded, error,
    playQueue, playAt, toggle, next, previous, seek, setVolume, toggleMute, cycleRepeat, toggleShuffle, playNext, addToQueue,
    removeAt, clearUpcoming, close, pause, source]);
  const progress = useMemo(() => ({ position, duration, ready }), [position, duration, ready]);

  return (
    <Ctx.Provider value={value}>
      <ProgressCtx.Provider value={progress}>
        {children}
      </ProgressCtx.Provider>
      {/* Pas de crossOrigin : le stockage audio n'ouvre pas ses règles CORS au site. */}
      <audio ref={audioRef} preload="auto" className="hidden" />
    </Ctx.Provider>
  );
}

/** Position et durée du titre en cours (barres de progression seulement). */
export function useMusicProgress(): Progress {
  return useContext(ProgressCtx);
}

export function useMusicPlayer(): PlayerContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMusicPlayer doit être utilisé dans MusicPlayerProvider");
  return ctx;
}

/** Pour les composants qui doivent fonctionner aussi hors du lecteur (bandeau d'app…). */
export function useMusicPlayerOptional(): PlayerContext | null {
  return useContext(Ctx);
}
