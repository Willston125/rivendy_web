"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ExternalLink, Loader2, Play, Square, X } from "lucide-react";
import { isMusicPath } from "@/components/layout/hide-in-music";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { MEDIA_PLAY_EVENT } from "@/features/media/device-id";
import { cn } from "@/lib/utils/cn";
import { inviteLogin } from "../music-login-invite";
import { reportRadioListen } from "./radio-api";
import {
  RADIO_PING_MS, radioInitials, radioListenSeconds, radioPlayableHere, radioRetryDelay, type RadioStation,
} from "./radio-logic";

/**
 * Lecteur des radios en direct du site (2026-11-11). Un élément <audio> à
 * lui, à côté de celui de la Musique : le lecteur des titres (liens signés,
 * comptage, affiches) n'est pas touché. Les deux se coupent l'un l'autre par
 * MEDIA_PLAY_EVENT, comme la vidéo de Rivendy Play.
 *
 * Du direct : pas de barre de progression ; reprendre après une pause
 * repart au direct ; une coupure est retentée trois fois (2 s, 5 s, 10 s).
 * Écouter demande un compte (comme la musique), sauf l'aperçu privé d'une
 * station, qui ne compte jamais d'écoute.
 */

type RadioPlayer = {
  station: RadioStation | null;
  playing: boolean;
  loading: boolean;
  error: string | null;
  /** Aperçu privé : aucun compte demandé, rien n'est compté. */
  preview: boolean;
  play: (station: RadioStation, options?: { preview?: boolean }) => void;
  toggle: () => void;
  stop: () => void;
};

const Ctx = createContext<RadioPlayer | null>(null);

export function useRadioPlayer(): RadioPlayer {
  const value = useContext(Ctx);
  if (!value) throw new Error("useRadioPlayer : RadioPlayerProvider manquant");
  return value;
}

/** Délai sans son avant de considérer la radio coupée. */
const SILENCE_MS = 15_000;
const DEAD = "Cette radio ne répond pas pour le moment. Réessayez plus tard ou choisissez-en une autre.";

export function RadioPlayerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { country } = useCountry();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [station, setStation] = useState<RadioStation | null>(null);
  const [preview, setPreview] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stationRef = useRef<RadioStation | null>(null);
  const previewRef = useRef(false);
  const signedIn = useRef(false);
  const market = useRef<string | null>(null);
  const attempts = useRef(0);
  const retryTimer = useRef<number | null>(null);
  const silenceTimer = useRef<number | null>(null);
  const lastPing = useRef(0);
  const startCounted = useRef(false);
  /** L'auditeur a mis le direct en pause : une coupure ne relance rien. */
  const userPaused = useRef(false);

  useEffect(() => { signedIn.current = !!user; }, [user]);
  useEffect(() => { market.current = country?.id ?? null; }, [country?.id]);

  const clearTimers = useCallback(() => {
    if (retryTimer.current) window.clearTimeout(retryTimer.current);
    if (silenceTimer.current) window.clearTimeout(silenceTimer.current);
    retryTimer.current = null;
    silenceTimer.current = null;
  }, []);

  /** Temps écouté depuis le dernier envoi (rien pour un aperçu ou sans compte). */
  const flush = useCallback(() => {
    if (!lastPing.current) return;
    const now = Date.now();
    const seconds = radioListenSeconds(now - lastPing.current);
    lastPing.current = now;
    const s = stationRef.current;
    if (s && !previewRef.current && signedIn.current && seconds > 0) {
      void reportRadioListen(s.id, market.current, seconds, false);
    }
  }, []);

  const connect = useCallback((s: RadioStation) => {
    const audio = audioRef.current;
    if (!audio) return;
    userPaused.current = false;
    audio.src = s.stream_url;
    void audio.play()
      .then(() => window.dispatchEvent(new CustomEvent(MEDIA_PLAY_EVENT, { detail: "radio" })))
      .catch(() => { setLoading(false); setPlaying(false); });
  }, []);

  /** Coupure : nouvel essai après 2, 5 puis 10 s, puis on le dit. */
  const retry = useCallback(() => {
    const s = stationRef.current;
    if (!s || retryTimer.current || userPaused.current) return;
    flush();
    lastPing.current = 0;
    const attempt = attempts.current + 1;
    const delay = radioRetryDelay(attempt);
    if (delay === null) {
      clearTimers();
      setLoading(false);
      setPlaying(false);
      setError(DEAD);
      audioRef.current?.pause();
      return;
    }
    attempts.current = attempt;
    setLoading(true);
    retryTimer.current = window.setTimeout(() => {
      retryTimer.current = null;
      if (stationRef.current?.id === s.id) connect(s);
    }, delay);
  }, [clearTimers, connect, flush]);

  const stop = useCallback(() => {
    flush();
    lastPing.current = 0;
    clearTimers();
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); }
    stationRef.current = null;
    previewRef.current = false;
    setStation(null);
    setPreview(false);
    setPlaying(false);
    setLoading(false);
    setError(null);
  }, [clearTimers, flush]);

  const play = useCallback((s: RadioStation, options?: { preview?: boolean }) => {
    const isPreview = !!options?.preview;
    if (!isPreview && !signedIn.current) {
      inviteLogin({ kind: "play", label: s.name });
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    flush();
    lastPing.current = 0;
    clearTimers();
    attempts.current = 0;
    startCounted.current = false;
    stationRef.current = s;
    previewRef.current = isPreview;
    setStation(s);
    setPreview(isPreview);
    setPlaying(false);
    const canHls = audio.canPlayType("application/vnd.apple.mpegurl") !== "";
    if (!radioPlayableHere(s.stream_format, canHls)) {
      audio.pause();
      setLoading(false);
      setError("Ce navigateur ne lit pas le format de cette radio : écoutez-la dans l’application Rivendy.");
      return;
    }
    setError(null);
    setLoading(true);
    connect(s);
  }, [clearTimers, connect, flush]);

  /** Arrêt voulu : plus de nouvel essai, ni de veille du silence. */
  const pause = useCallback(() => {
    userPaused.current = true;
    clearTimers();
    setLoading(false);
    audioRef.current?.pause();
  }, [clearTimers]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    const s = stationRef.current;
    if (!audio || !s) return;
    if (audio.paused) {
      // Du direct : on repart au direct, pas là où l'on s'était arrêté.
      attempts.current = 0;
      setError(null);
      setLoading(true);
      connect(s);
    } else {
      pause();
    }
  }, [connect, pause]);

  // ── Événements de l'élément audio ────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlaying = () => {
      if (silenceTimer.current) { window.clearTimeout(silenceTimer.current); silenceTimer.current = null; }
      attempts.current = 0;
      setLoading(false);
      setPlaying(true);
      setError(null);
      lastPing.current = Date.now();
      const s = stationRef.current;
      if (s && !startCounted.current && !previewRef.current && signedIn.current) {
        startCounted.current = true;
        void reportRadioListen(s.id, market.current, 0, true);
      }
    };
    const onPause = () => {
      if (silenceTimer.current) { window.clearTimeout(silenceTimer.current); silenceTimer.current = null; }
      flush();
      lastPing.current = 0;
      setPlaying(false);
      if (!retryTimer.current) setLoading(false);
    };
    const onWaiting = () => {
      setLoading(true);
      if (!silenceTimer.current) {
        silenceTimer.current = window.setTimeout(() => { silenceTimer.current = null; retry(); }, SILENCE_MS);
      }
    };
    const onBroken = () => { if (stationRef.current && audio.getAttribute("src")) retry(); };
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("error", onBroken);
    audio.addEventListener("ended", onBroken);
    return () => {
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("error", onBroken);
      audio.removeEventListener("ended", onBroken);
    };
  }, [flush, retry]);

  // ── Toutes les 60 s : temps écouté (chiffres envoyés aux stations) ───────
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(flush, RADIO_PING_MS);
    return () => window.clearInterval(timer);
  }, [flush, playing]);

  // ── Une musique ou une vidéo démarre : la radio s'arrête ─────────────────
  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent).detail !== "radio" && stationRef.current) stop();
    };
    window.addEventListener(MEDIA_PLAY_EVENT, onOther);
    return () => window.removeEventListener(MEDIA_PLAY_EVENT, onOther);
  }, [stop]);

  // ── Déconnexion : la radio s'arrête (sauf l'aperçu d'une station) ────────
  useEffect(() => {
    if (!user && stationRef.current && !previewRef.current) stop();
  }, [stop, user]);

  // ── Fermeture de l'onglet : le dernier temps écouté part ─────────────────
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [flush]);

  // ── Écran verrouillé et touches multimédia ───────────────────────────────
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator) || !station) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: station.name,
      artist: "En direct · Rivendy Musique",
      artwork: station.logo_url ? [{ src: station.logo_url, sizes: "512x512" }] : [],
    });
    navigator.mediaSession.setActionHandler("play", () => toggle());
    navigator.mediaSession.setActionHandler("pause", () => pause());
    navigator.mediaSession.setActionHandler("stop", () => stop());
    navigator.mediaSession.setActionHandler("seekto", null);
    navigator.mediaSession.setActionHandler("nexttrack", null);
    navigator.mediaSession.setActionHandler("previoustrack", null);
  }, [pause, station, stop, toggle]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const value = useMemo<RadioPlayer>(
    () => ({ station, playing, loading, error, preview, play, toggle, stop }),
    [station, playing, loading, error, preview, play, toggle, stop],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Pas de crossOrigin : écouter un flux n'en demande pas (CORS n'est utile qu'à l'analyse du son). */}
      <audio ref={audioRef} preload="none" className="hidden" />
    </Ctx.Provider>
  );
}

/** Logo de la radio, ou ses initiales. */
export function RadioLogo({ station, className }: { station: RadioStation; className?: string }) {
  if (station.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={station.logo_url} alt="" className={cn("shrink-0 rounded-lg object-cover", className)} />;
  }
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-lg bg-rvm-deep-2 font-rvm-display font-black text-white", className)}>
      {radioInitials(station.name)}
    </span>
  );
}

/** « EN DIRECT » avec son voyant. */
export function LiveBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-rvm-accent px-2 py-0.5 text-[11px] font-black tracking-[0.12em] text-rvm-on-accent", className)}>
      <span aria-hidden className="h-2 w-2 rounded-full bg-red-600" />EN DIRECT
    </span>
  );
}

/**
 * Hors de l'espace Musique : la radio continue (lecteur monté pour tout le
 * site), sa barre flotte en bas, au-dessus du mini-lecteur de musique s'il
 * est affiché — jamais une radio qu'on ne peut plus arrêter.
 */
export function RadioDock() {
  const r = useRadioPlayer();
  const pathname = usePathname();
  if (!r.station || isMusicPath(pathname)) return null;
  return (
    <div className="fixed inset-x-2 z-40 overflow-hidden rounded-2xl shadow-lg shadow-black/20 md:inset-x-auto md:right-4 md:w-[460px]"
      style={{ bottom: "calc(var(--rvm-player-h, 0px) + 12px + env(safe-area-inset-bottom, 0px))" }}>
      <RadioBar />
    </div>
  );
}

/**
 * Barre de la radio en cours, à la place du lecteur de musique tant qu'une
 * radio est choisie (coque Musique, ordinateur et téléphone).
 */
export function RadioBar({ className }: { className?: string }) {
  const r = useRadioPlayer();
  const s = r.station;
  if (!s) return null;
  const status = r.error ?? (r.loading ? "Connexion à la radio…" : r.playing ? "En direct" : "En pause");
  return (
    <section aria-label={`Radio en direct : ${s.name}`}
      className={cn("rvm-scope rvm-deep flex min-h-16 shrink-0 items-center gap-3 px-3 py-2 text-rvm-text md:h-[84px] md:px-4", className)}>
      <RadioLogo station={s} className="h-11 w-11 text-xs md:h-14 md:w-14 md:text-sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{s.name}</p>
        <p className={cn("flex items-center gap-2 truncate text-[13px]", r.error ? "text-amber-200" : "text-rvm-soft")} role="status">
          {!r.error && r.playing ? <LiveBadge className="hidden sm:inline-flex" /> : null}
          <span className="truncate">{status}{r.preview ? " · aperçu privé" : ""}</span>
        </p>
      </div>
      {s.homepage_url ? (
        <a href={s.homepage_url} target="_blank" rel="noopener noreferrer"
          className="hidden items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-rvm-text hover:bg-white/10 md:inline-flex">
          Site de la radio <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      ) : null}
      <button type="button" onClick={r.toggle}
        aria-label={r.playing ? `Arrêter ${s.name}` : `Écouter ${s.name}`}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rvm-accent text-rvm-on-accent hover:bg-rvm-accent-hover md:h-12 md:w-12">
        {r.loading && !r.error ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          : r.playing ? <Square className="h-4 w-4 fill-current" aria-hidden /> : <Play className="h-5 w-5 fill-current" aria-hidden />}
      </button>
      <button type="button" onClick={r.stop} aria-label="Fermer la radio" title="Fermer"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-rvm-soft hover:bg-white/10 hover:text-rvm-text">
        <X className="h-5 w-5" aria-hidden />
      </button>
    </section>
  );
}
