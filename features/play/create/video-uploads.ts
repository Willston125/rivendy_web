"use client";

import { useEffect, useSyncExternalStore } from "react";
import { UploadError, type UploadContext } from "./create-api";

/**
 * Envoi d'une vidéo (clip ou Short) — l'équivalent du PlayUploadManager de
 * l'app : UN envoi à la fois pour tout le site (la connexion est souvent
 * lente). Il vit hors des écrans : on peut quitter la page et continuer à
 * naviguer sur Rivendy, l'envoi se poursuit et un bandeau le suit. Seuls la
 * fermeture de l'onglet ou le rechargement l'arrêtent : le navigateur demande
 * alors confirmation. « Renvoyer » relance le même fichier, sans le rechoisir.
 */

export type VideoUploadPhase = "uploading" | "retrying" | "failed" | "done";

export type VideoUpload = {
  id: number;
  kind: "clip" | "short";
  label: string;
  progress: number;
  phase: VideoUploadPhase;
  /** Échec : ce qui s'est passé ; fin : le message de réussite. */
  message: string | null;
  /** Coupure : reprise n° `attempt` sur 5, dans `delayMs`. */
  retry: { attempt: number; delayMs: number } | null;
  /** Où suivre la vidéo une fois envoyée. */
  doneHref: string | null;
  doneLabel: string | null;
};

/** La tâche reçoit le numéro de l'essai (0 au premier envoi, puis à chaque « Renvoyer »). */
export type VideoUploadTask = (ctx: UploadContext, attempt: number) => Promise<void>;

type Job = { upload: VideoUpload; task: VideoUploadTask; success: string; controller: AbortController | null; attempt: number };

let job: Job | null = null;
let snapshot: VideoUpload | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const settledListeners = new Set<(u: VideoUpload) => void>();

function emit() {
  snapshot = job ? { ...job.upload } : null;
  for (const l of listeners) l();
  syncUnloadGuard();
}

function patch(j: Job, change: Partial<VideoUpload>) {
  if (job !== j) return;
  j.upload = { ...j.upload, ...change };
  emit();
}

/** Un envoi est-il en cours (ou en reprise) ? */
export function videoUploadBusy(): boolean {
  return !!job && (job.upload.phase === "uploading" || job.upload.phase === "retrying");
}

// Fermer l'onglet ou recharger pendant un envoi : le navigateur demande confirmation.
let guardOn = false;
function onBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault();
  e.returnValue = "";
}
function syncUnloadGuard() {
  if (typeof window === "undefined") return;
  const busy = videoUploadBusy();
  if (busy && !guardOn) window.addEventListener("beforeunload", onBeforeUnload);
  if (!busy && guardOn) window.removeEventListener("beforeunload", onBeforeUnload);
  guardOn = busy;
}

async function run(j: Job) {
  const controller = new AbortController();
  j.controller = controller;
  let lastPct = -1;
  const ctx: UploadContext = {
    signal: controller.signal,
    onProgress: (ratio) => {
      // Pas plus d'un rafraîchissement par pour cent : l'écran reste fluide.
      const pct = Math.floor(ratio * 100);
      if (pct === lastPct && j.upload.phase === "uploading") return;
      lastPct = pct;
      patch(j, { progress: ratio, phase: "uploading", retry: null });
    },
    onRetry: (attempt, delayMs) => patch(j, { phase: "retrying", retry: { attempt, delayMs } }),
  };
  try {
    await j.task(ctx, j.attempt);
    patch(j, { phase: "done", progress: 1, message: j.success, retry: null });
  } catch (e) {
    patch(j, { phase: "failed", retry: null, message: e instanceof UploadError ? e.message : "L’envoi de la vidéo a échoué, réessayez." });
  } finally {
    j.controller = null;
    if (job === j) for (const l of settledListeners) l({ ...j.upload });
  }
}

/** Lance un envoi. Faux si un autre est déjà en cours (« Un envoi est déjà en cours »). */
export function startVideoUpload(o: {
  kind: "clip" | "short"; label: string; task: VideoUploadTask; success: string; doneHref?: string; doneLabel?: string;
}): boolean {
  if (videoUploadBusy()) return false;
  const j: Job = {
    upload: {
      id: ++seq, kind: o.kind, label: o.label, progress: 0, phase: "uploading", message: null, retry: null,
      doneHref: o.doneHref ?? null, doneLabel: o.doneLabel ?? null,
    },
    task: o.task, success: o.success, controller: null, attempt: 0,
  };
  job = j;
  emit();
  void run(j);
  return true;
}

/** « Annuler » : coupe l'envoi en cours ; la place du quota est rendue. */
export function cancelVideoUpload() {
  job?.controller?.abort();
}

/** « Renvoyer » : relance le même fichier après un échec. */
export function retryVideoUpload() {
  const j = job;
  if (!j || j.upload.phase !== "failed") return;
  j.attempt += 1;
  j.upload = { ...j.upload, phase: "uploading", progress: 0, message: null, retry: null };
  emit();
  void run(j);
}

/** « Fermer » : oublie un envoi terminé ou abandonné. */
export function dismissVideoUpload() {
  if (!job || videoUploadBusy()) return;
  job = null;
  emit();
}

/** Prévient quand un envoi se termine (réussi ou non) : la page relit sa liste. */
export function onVideoUploadSettled(listener: (u: VideoUpload) => void): () => void {
  settledListeners.add(listener);
  return () => { settledListeners.delete(listener); };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** L'envoi en cours, terminé ou échoué (null : aucun). */
export function useVideoUpload(): VideoUpload | null {
  return useSyncExternalStore(subscribe, () => snapshot, () => null);
}

// Une page qui montre l'envoi dans son contenu (espace artiste, Mes Shorts)
// masque le bandeau flottant : jamais deux fois la même information.
let inlineCount = 0;
const inlineListeners = new Set<() => void>();
function setInline(delta: number) {
  inlineCount += delta;
  for (const l of inlineListeners) l();
}

export function useInlineUploadSlot() {
  useEffect(() => {
    setInline(1);
    return () => setInline(-1);
  }, []);
}

export function useInlineUploadShown(): boolean {
  return useSyncExternalStore(
    (l) => { inlineListeners.add(l); return () => { inlineListeners.delete(l); }; },
    () => inlineCount > 0,
    () => false,
  );
}
