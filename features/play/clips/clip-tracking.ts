"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { MEDIA_PLAY_EVENT } from "@/features/media/device-id";
import { playbackClose, recordView, rpcOnExit, viewProgress, viewQualify, viewStart } from "../play-api";

/**
 * Comptage d'un clip regardé sur le site (refonte Clips du 2026-10-26) — les
 * MÊMES appels, dans le même ordre, que la lecture des films (WatchView) et
 * que l'app :
 *   première image → play_record_short_event (vue du jour, historique) +
 *   play_view_start ;
 *   temps réellement regardé ≥ seuil du serveur → play_view_qualify ;
 *   toutes les 60 s, à la pause et à la sortie → play_view_progress ;
 *   sortie → playback_close si le serveur a ouvert une session d'écran.
 * « Réellement regardé » : en lecture, son non coupé, vitesse ≤ 2×. Aucune
 * position de reprise pour un clip (comme pour les films : clips exclus).
 *
 * Une seule lecture à la fois : le clip prévient la Musique et les autres
 * vidéos du site (MEDIA_PLAY_EVENT) et se met en pause si l'une d'elles part.
 */
export function useClipViewTracking(video: HTMLVideoElement | null, titleId: string, sessionId: string | null) {
  const { session } = useAuth();
  const token = useRef<string | null>(null);
  useEffect(() => { token.current = session?.access_token ?? null; }, [session]);

  useEffect(() => {
    if (!video) return;
    const t = {
      started: false, watched: 0, wait: null as number | null, qualified: false, qualifying: false,
      nextQualifyAt: 0, sentWatched: 0, sessionId,
    };

    const sendProgress = (onExit: boolean) => {
      if (!t.qualified || t.watched <= t.sentWatched) return;
      t.sentWatched = t.watched;
      if (onExit) rpcOnExit("play_view_progress", { p_kind: "title", p_id: titleId, p_watched: Math.round(t.watched) }, token.current);
      else void viewProgress("title", titleId, t.watched);
    };
    const close = (onExit: boolean) => {
      const id = t.sessionId;
      t.sessionId = null;
      if (!id) return;
      if (onExit) rpcOnExit("playback_close", { p_session: id }, token.current);
      else void playbackClose(id);
    };

    const onPlay = () => { window.dispatchEvent(new CustomEvent(MEDIA_PLAY_EVENT, { detail: "video" })); };
    const onPause = () => sendProgress(false);
    const onOther = (e: Event) => { if ((e as CustomEvent).detail !== "video") video.pause(); };

    const timer = window.setInterval(() => {
      if (video.paused || video.ended || video.readyState < 3) return;
      if (!t.started) {
        t.started = true;
        void recordView(titleId);
        void viewStart("title", titleId).then((w) => { t.wait = w; });
      }
      if (!video.muted && video.volume > 0 && video.playbackRate <= 2) t.watched += 1;
      const now = Date.now();
      if (t.wait != null && !t.qualified && !t.qualifying && t.watched >= t.wait && now >= t.nextQualifyAt) {
        t.qualifying = true;
        void viewQualify("title", titleId).then((r) => {
          t.qualifying = false;
          if (r.reason === "too_early" || r.reason === "network") t.nextQualifyAt = Date.now() + 5_000;
          else t.qualified = true;
        });
      }
      if (t.qualified && t.watched - t.sentWatched >= 60) sendProgress(false);
    }, 1000);

    const onHide = () => { sendProgress(true); close(true); };
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    window.addEventListener(MEDIA_PLAY_EVENT, onOther);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.clearInterval(timer);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      window.removeEventListener(MEDIA_PLAY_EVENT, onOther);
      window.removeEventListener("pagehide", onHide);
      sendProgress(false);
      close(false);
    };
  }, [video, titleId, sessionId]);
}
