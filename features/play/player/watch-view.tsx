"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Lock, Smartphone } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { MEDIA_PLAY_EVENT, deviceId } from "@/features/media/device-id";
import { appIntentUrl } from "../play-link-page";
import {
  fetchEpisode, fetchEpisodes, fetchPlayback, fetchProgress, fetchSubtitles, fetchTitlesByIds,
  playbackClose, playbackPing, recordView, rpcOnExit, saveProgress, viewProgress, viewQualify, viewStart,
  type PlaybackGrant,
} from "../play-api";
import {
  isArtistClip, kindOf, nextEpisode, playbackErrorMessage, resumeAt, titlePath, upNextAt, wideImage,
  type PlayEpisode, type PlayTitle,
} from "../play-logic";
import { btnPrimary, btnSecondary, display } from "../play-theme";
import { EmptyState, PlayPage, Spinner } from "../play-ui";
import { VideoPlayer, type FatalReason } from "./video-player";

/**
 * Page de lecture du site (Omnicanal lot C, §7.4) : `/play/watch/{movie|episode|clip}/{id}`.
 * Mêmes appels que l'app, dans le même ordre :
 *   ouverture → play-playback-token (droits, écran, jeton) ;
 *   début → play_record_short_event (historique) + play_view_start ;
 *   30 s de lecture réelle → play_view_qualify ;
 *   toutes les 15 s, pause, sortie → play_save_progress (reprise) ;
 *   toutes les 60 s, pause, sortie → play_view_progress + playback_ping ;
 *   fin → derniers envois + playback_close (keepalive à la fermeture).
 * « Lecture réelle » : en lecture, son non coupé, vitesse ≤ 2×. Les seuils et
 * plafonds restent dans les fonctions serveur.
 */

export type WatchKind = "movie" | "episode" | "clip";

type Loaded = { title: PlayTitle; episode: PlayEpisode | null; episodes: PlayEpisode[] };

type Tracker = {
  viewKind: "title" | "episode";
  viewId: string;
  started: boolean;
  watched: number;
  wait: number | null;
  qualified: boolean;
  qualifying: boolean;
  nextQualifyAt: number;
  sentWatched: number;
  lastSave: number;
  lastPing: number;
  sessionId: string | null;
  savePositions: boolean;
  preview: boolean;
};

const STOP_MESSAGES: Record<string, string> = {
  taken_over: "La lecture a été reprise sur un autre écran.",
  expired: "Votre Rivendy+ a expiré : la lecture s’est arrêtée.",
  timeout: "La lecture s’est arrêtée après une longue pause.",
};

export function WatchView({ kind, id, start }: { kind: WatchKind; id: string; start: number | null }) {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null | undefined>(undefined);
  const [grant, setGrant] = useState<PlaybackGrant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startAt, setStartAt] = useState(0);
  const [subtitles, setSubtitles] = useState<Array<{ lang: string; url: string }>>([]);
  const [stopped, setStopped] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  // Élément vidéo ET compteur de la lecture qu'il porte : un nouveau jeton crée
  // un nouveau lecteur ; l'ancien se ferme avec SON compteur, jamais le nouveau.
  const [binding, setBinding] = useState<{ video: HTMLVideoElement; tracker: Tracker } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [takeOver, setTakeOver] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const tracker = useRef<Tracker | null>(null);
  const refreshes = useRef(0);
  const resumeRef = useRef<number | null>(null);

  useEffect(() => { tokenRef.current = session?.access_token ?? null; }, [session]);
  const onVideo = useCallback((v: HTMLVideoElement | null) => {
    const t = tracker.current;
    setBinding(v && t ? { video: v, tracker: t } : null);
  }, []);

  // 1. Le contenu (titre, épisode, épisodes de la série).
  useEffect(() => {
    let alive = true;
    void (async () => {
      let episode: PlayEpisode | null = null;
      let titleId = id;
      if (kind === "episode") {
        episode = await fetchEpisode(id);
        if (!episode) { if (alive) setLoaded(null); return; }
        titleId = episode.title_id;
      }
      const [title] = await fetchTitlesByIds([titleId]);
      if (!alive) return;
      if (!title) { setLoaded(null); return; }
      const k = kindOf(title.kind);
      if ((kind === "movie" && k !== "film") || (kind === "clip" && k !== "clip") || (kind === "episode" && k !== "serie")) {
        router.replace(titlePath(title));
        return;
      }
      const episodes = kind === "episode" ? await fetchEpisodes(title.id) : [];
      if (alive) setLoaded({ title, episode, episodes });
    })();
    return () => { alive = false; };
  }, [kind, id, router]);

  // 2. La lecture (droits vérifiés par le serveur), puis la position de reprise.
  useEffect(() => {
    if (!loaded || !user) return;
    let alive = true;
    const titleId = loaded.title.id;
    const episodeId = loaded.episode?.id ?? null;
    void (async () => {
      const [res, progress, subs] = await Promise.all([
        fetchPlayback(titleId, episodeId, deviceId(), takeOver),
        fetchProgress(),
        fetchSubtitles(titleId, episodeId),
      ]);
      if (!alive) return;
      if (!res.ok) { setGrant(null); setError(res.error); return; }
      setError(null);
      let at = 0;
      if (resumeRef.current != null) at = resumeRef.current;
      else if (start != null) at = Math.max(0, start);
      else if (!res.grant.preview) {
        const p = progress.find((x) => x.title_id === titleId && (x.episode_id ?? null) === episodeId);
        if (p) at = resumeAt(p.position_seconds, p.duration_seconds);
      }
      const refreshing = resumeRef.current != null;
      resumeRef.current = null;
      const viewKind = episodeId ? "episode" : "title";
      const viewId = episodeId ?? titleId;
      // Nouveau jeton pour la MÊME lecture : le temps regardé continue.
      const prev = refreshing && tracker.current?.viewId === viewId ? tracker.current : null;
      tracker.current = {
        viewKind, viewId,
        started: prev?.started ?? false, watched: prev?.watched ?? 0, wait: prev?.wait ?? null,
        qualified: prev?.qualified ?? false, qualifying: false, nextQualifyAt: 0,
        sentWatched: prev?.sentWatched ?? 0, lastSave: Date.now(), lastPing: Date.now(),
        sessionId: res.grant.playback_session_id,
        // Positions gardées pour les films et les épisodes (pas les clips, pas les aperçus).
        savePositions: kind !== "clip" && !res.grant.preview,
        preview: res.grant.preview,
      };
      setSubtitles(subs);
      setStartAt(at);
      setStopped(null);
      setEnded(false);
      setGrant(res.grant);
    })();
    return () => { alive = false; };
  }, [loaded, user, start, attempt, takeOver, kind]);

  // 3. Le comptage, branché sur l'élément vidéo.
  useEffect(() => {
    if (!binding || !loaded) return;
    const v = binding.video;
    const bound = binding.tracker;
    const titleId = loaded.title.id;
    const episodeId = loaded.episode?.id ?? null;
    // Le compteur de CETTE lecture (un nouveau jeton en crée un autre).
    const live = () => (tracker.current === bound ? bound : null);

    // Derniers envois : position, temps regardé, écran libéré — sauf l'écran
    // que la lecture suivante utilise encore (même appareil = même session).
    const flush = (onExit: boolean) => {
      const t = bound;
      const pos = Math.floor(v.currentTime);
      const dur = Number.isFinite(v.duration) ? Math.round(v.duration) : 0;
      const sessionInUse = tracker.current !== t && !!t.sessionId && tracker.current?.sessionId === t.sessionId;
      const closeId = t.sessionId && !sessionInUse ? t.sessionId : null;
      if (onExit) {
        const token = tokenRef.current;
        if (t.savePositions && dur > 0) rpcOnExit("play_save_progress", { p_title_id: titleId, p_episode_id: episodeId, p_position: pos, p_duration: dur }, token);
        if (t.qualified && t.watched > t.sentWatched) rpcOnExit("play_view_progress", { p_kind: t.viewKind, p_id: t.viewId, p_watched: Math.round(t.watched) }, token);
        if (closeId) rpcOnExit("playback_close", { p_session: closeId }, token);
      } else {
        if (t.savePositions && dur > 0) void saveProgress(titleId, episodeId, pos, dur);
        if (t.qualified && t.watched > t.sentWatched) void viewProgress(t.viewKind, t.viewId, t.watched);
        if (closeId) void playbackClose(closeId);
      }
      t.sentWatched = t.watched;
      if (!sessionInUse) t.sessionId = null;
    };

    const firstPlay = (t: Tracker) => {
      t.started = true;
      void recordView(titleId);
      // Clips, films et épisodes : début de vue (le serveur écarte les aperçus).
      if (!t.preview) void viewStart(t.viewKind, t.viewId).then((w) => { t.wait = w; });
    };
    const ping = (t: Tracker) => {
      if (!t.sessionId) return;
      t.lastPing = Date.now();
      const sessionId = t.sessionId;
      void playbackPing(sessionId).then((status) => {
        if (!status || status === "ok" || !live()) return;
        t.sessionId = null;
        v.pause();
        setStopped(STOP_MESSAGES[status] ?? "La lecture s’est arrêtée.");
      });
    };
    const onPlay = () => {
      window.dispatchEvent(new CustomEvent(MEDIA_PLAY_EVENT, { detail: "video" }));
      const t = live();
      if (t && t.sessionId && Date.now() - t.lastPing > 150_000) ping(t);
    };
    const onPause = () => {
      const t = live();
      if (!t) return;
      const dur = Number.isFinite(v.duration) ? v.duration : 0;
      if (t.savePositions && dur > 0) { t.lastSave = Date.now(); void saveProgress(titleId, episodeId, v.currentTime, dur); }
      if (t.qualified && t.watched > t.sentWatched) { t.sentWatched = t.watched; void viewProgress(t.viewKind, t.viewId, t.watched); }
    };
    const onOther = (e: Event) => { if ((e as CustomEvent).detail !== "video") v.pause(); };

    const timer = window.setInterval(() => {
      const t = live();
      if (!t || v.paused || v.ended || v.readyState < 3) return;
      if (!t.started) firstPlay(t);
      if (!v.muted && v.volume > 0 && v.playbackRate <= 2) t.watched += 1;
      const nowMs = Date.now();
      if (t.wait != null && !t.qualified && !t.qualifying && t.watched >= t.wait && nowMs >= t.nextQualifyAt) {
        t.qualifying = true;
        void viewQualify(t.viewKind, t.viewId).then((r) => {
          t.qualifying = false;
          if (r.reason === "too_early" || r.reason === "network") t.nextQualifyAt = Date.now() + 5_000;
          else t.qualified = true;
        });
      }
      if (t.qualified && t.watched - t.sentWatched >= 60) { t.sentWatched = t.watched; void viewProgress(t.viewKind, t.viewId, t.watched); }
      if (t.savePositions && nowMs - t.lastSave >= 15_000) {
        t.lastSave = nowMs;
        const dur = Number.isFinite(v.duration) ? v.duration : 0;
        if (dur > 0) void saveProgress(titleId, episodeId, v.currentTime, dur);
      }
      if (t.sessionId && nowMs - t.lastPing >= 60_000) ping(t);
    }, 1000);

    const onHide = () => flush(true);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    window.addEventListener(MEDIA_PLAY_EVENT, onOther);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.clearInterval(timer);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      window.removeEventListener(MEDIA_PLAY_EVENT, onOther);
      window.removeEventListener("pagehide", onHide);
      flush(false);
    };
  }, [binding, loaded]);

  // Jeton échu pendant la lecture : nouvelle demande, reprise à la même seconde.
  const onFatal = useCallback((reason: FatalReason) => {
    if (reason === "auth" && refreshes.current < 2) {
      refreshes.current += 1;
      resumeRef.current = binding ? Math.floor(binding.video.currentTime) : null;
      setAttempt((n) => n + 1);
      return;
    }
    setError(reason === "network" ? "network" : "media");
  }, [binding]);

  const next = loaded?.episode
    ? nextEpisode(loaded.episodes, loaded.episode.id, (e) =>
        !loaded.title.is_premium || !!e.is_free_preview || (!!grant?.premium && !grant.preview))
    : null;
  const goNext = useCallback(() => { if (next) router.push(`/play/watch/episode/${next.id}`); }, [next, router]);

  // ── Écrans ───────────────────────────────────────────────────────────────

  const here = `/play/watch/${kind}/${id}`;
  if (loaded === null) {
    return (
      <PlayPage className="max-w-[1320px]">
        <EmptyState title="Ce titre n’est plus disponible" text="Il a peut-être été retiré du catalogue.">
          <Link href="/play" className={btnSecondary}>Retour à Rivendy Play</Link>
        </EmptyState>
      </PlayPage>
    );
  }
  if (loaded === undefined || authLoading) {
    return <PlayPage className="max-w-[1320px]"><Spinner label="Préparation de la lecture…" /></PlayPage>;
  }

  const { title, episode } = loaded;
  const heading = episode ? `${title.title} · S${episode.season} É${episode.episode_number} — ${episode.title}` : title.title;
  const back = (
    <Link href={episode ? `/play/series/${title.id}` : titlePath(title)} className="mb-3 inline-flex h-10 items-center gap-1 rounded-lg text-sm font-semibold text-rvp-soft transition-colors hover:text-rvp-accent">
      <ChevronLeft className="h-4 w-4" /> {title.title}
    </Link>
  );

  if (!user) {
    return (
      <PlayPage className="max-w-[1320px]">
        {back}
        <Notice title="Connectez-vous pour regarder" text="Votre compte Rivendy est le même sur le site et dans l’application : la lecture reprend où vous l’avez laissée.">
          <Link href={`/auth/login?next=${encodeURIComponent(here)}`} className={btnPrimary}>Se connecter</Link>
        </Notice>
      </PlayPage>
    );
  }

  if (error) {
    return (
      <PlayPage className="max-w-[1320px]">
        {back}
        <Notice title={heading} text={playbackErrorMessage(error)}>
          {error === "pass_required" ? (
            <Link href="/plus" className={btnPrimary}>Découvrir Rivendy+</Link>
          ) : null}
          {error === "too_many_streams" ? (
            <button type="button" onClick={() => { setTakeOver(true); setAttempt((n) => n + 1); }}
              className={btnPrimary}>Regarder ici (arrête l’autre écran)</button>
          ) : null}
          {error === "personal_token_required" ? (
            <a href={appIntentUrl(`/play/title/${title.id}`)} className={btnPrimary}>
              <Smartphone className="h-4 w-4" /> Ouvrir dans l’application
            </a>
          ) : null}
          {["network", "media", "bad_response", "too_many_requests", "internal", "signing_unavailable"].includes(error) ? (
            <button type="button" onClick={() => { refreshes.current = 0; setAttempt((n) => n + 1); }}
              className={btnSecondary}>Réessayer</button>
          ) : null}
        </Notice>
      </PlayPage>
    );
  }

  if (!grant) {
    return <PlayPage className="max-w-[1320px]">{back}<Spinner label="Préparation de la lecture…" /></PlayPage>;
  }

  const markers = episode ?? title;
  const duration = Number(episode?.duration_seconds ?? title.duration_seconds ?? 0);

  return (
    <PlayPage className="max-w-[1320px]">
      {back}
      <h1 className={`${display} mb-4 text-2xl text-rvp-text sm:text-3xl`}>{heading}</h1>
      {grant.preview ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-rvp-premium/30 bg-rvp-premium/10 px-4 py-3 text-sm text-rvp-soft">
          <Lock className="h-4 w-4 shrink-0 text-rvp-premium" aria-hidden />
          <span className="flex-1">
            Aperçu gratuit{grant.preview_seconds ? ` : les ${Math.max(1, Math.round(grant.preview_seconds / 60))} premières minutes` : ""}. La suite avec Rivendy+.
          </span>
          <Link href="/plus" className="font-bold text-rvp-premium underline underline-offset-4">Découvrir Rivendy+</Link>
        </div>
      ) : null}
      {stopped ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          <span className="flex-1">{stopped}</span>
          <button type="button" onClick={() => { resumeRef.current = binding ? Math.floor(binding.video.currentTime) : null; setTakeOver(true); setAttempt((n) => n + 1); }}
            className="font-bold text-amber-200 underline">Reprendre ici</button>
        </div>
      ) : null}
      <VideoPlayer
        key={`${attempt}:${grant.hls_url}`}
        src={grant.hls_url}
        poster={episode?.thumbnail_url || wideImage(title)}
        startAt={startAt}
        subtitles={subtitles}
        vertical={false}
        intro={kind === "clip" ? null : { start: markers.intro_start_s, end: markers.intro_end_s }}
        upNext={next ? { at: upNextAt(markers.credits_start_s, duration || Number.MAX_SAFE_INTEGER), label: "Épisode suivant", onGo: goNext } : null}
        onVideo={onVideo}
        onEnded={() => { setEnded(true); if (next && !grant.preview) goNext(); }}
        onFatal={onFatal}
      />
      {ended && grant.preview ? (
        <Notice title="Fin de l’aperçu" text="Regardez la suite avec Rivendy+, sur le site et dans l’application, avec le même compte.">
          <Link href="/plus" className={btnPrimary}>Découvrir Rivendy+</Link>
        </Notice>
      ) : null}
      {isArtistClip(title) && title.artist ? (
        <p className="mt-4 text-sm text-rvp-soft">
          Clip de <Link href={`/artist/${title.artist_id}`} className="font-bold text-rvp-accent underline-offset-4 hover:underline">{title.artist}</Link>
        </p>
      ) : null}
      {(episode?.synopsis || title.synopsis) ? (
        <p className="mt-4 max-w-3xl whitespace-pre-line text-[15px] leading-7 text-rvp-soft">{episode?.synopsis || title.synopsis}</p>
      ) : null}
    </PlayPage>
  );
}

function Notice({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="rvp-glass mx-auto mt-6 max-w-xl rounded-rvp-hero px-6 py-8 text-center">
      <h2 className={`${display} text-xl text-rvp-text`}>{title}</h2>
      <p className="mt-2 text-sm leading-6 text-rvp-soft">{text}</p>
      {children ? <div className="mt-5 flex flex-wrap justify-center gap-3">{children}</div> : null}
    </div>
  );
}

