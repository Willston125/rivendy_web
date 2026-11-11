"use client";

import { useSyncExternalStore } from "react";
import { confirmTrackUpload, NetworkCutError, putFile, requestTrackUpload, StudioError } from "./studio-api";

/**
 * Envois des fichiers audio du studio (lot 2, 2026-11-11) — l'équivalent du
 * PlayUploadManager de l'app : UNE file pour tout le site, un fichier à la
 * fois (la connexion est souvent lente). La file vit hors des écrans : on
 * peut quitter l'éditeur et continuer à naviguer sur Rivendy, l'envoi se
 * poursuit. Seuls la fermeture de l'onglet ou le rechargement l'arrêtent :
 * le navigateur demande alors confirmation. Un envoi coupé par le réseau
 * garde son fichier en mémoire : « Renvoyer » le reprend sans le rechoisir.
 */

export type UploadStatus = "queued" | "uploading" | "failed" | "done";

export type UploadItem = {
  trackId: string;
  releaseId: string;
  file: File;
  progress: number;
  status: UploadStatus;
  error: string | null;
  /** Coupure réseau (et non refus du serveur). */
  networkCut: boolean;
};

let items: UploadItem[] = [];
let running = false;
const listeners = new Set<() => void>();
const settledListeners = new Set<(item: UploadItem) => void>();

function emit() {
  items = [...items];
  for (const l of listeners) l();
  syncUnloadGuard();
}

function patch(trackId: string, change: Partial<UploadItem>) {
  items = items.map((it) => (it.trackId === trackId ? { ...it, ...change } : it));
  emit();
}

/** Envois en attente ou en cours ? */
export function uploadsBusy(): boolean {
  return items.some((it) => it.status === "queued" || it.status === "uploading");
}

// Fermer l'onglet ou recharger pendant un envoi : le navigateur demande confirmation.
let guardOn = false;
function onBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault();
  e.returnValue = "";
}
function syncUnloadGuard() {
  if (typeof window === "undefined") return;
  const busy = uploadsBusy();
  if (busy && !guardOn) window.addEventListener("beforeunload", onBeforeUnload);
  if (!busy && guardOn) window.removeEventListener("beforeunload", onBeforeUnload);
  guardOn = busy;
}

async function runQueue() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const next = items.find((it) => it.status === "queued");
      if (!next) break;
      patch(next.trackId, { status: "uploading", progress: 0, error: null, networkCut: false });
      try {
        const ticket = await requestTrackUpload(next.trackId, next.file);
        let last = 0;
        await putFile(ticket.uploadUrl, next.file, ticket.contentType, (ratio) => {
          // Pas plus d'un rafraîchissement par pour cent : l'écran reste fluide.
          const pct = Math.floor(ratio * 100);
          if (pct !== last) { last = pct; patch(next.trackId, { progress: ratio }); }
        });
        await confirmTrackUpload(next.trackId, ticket.key);
        patch(next.trackId, { status: "done", progress: 1 });
      } catch (e) {
        patch(next.trackId, {
          status: "failed",
          error: e instanceof StudioError ? e.message : "L’envoi du fichier a échoué, réessayez.",
          networkCut: e instanceof NetworkCutError,
        });
      }
      const settled = items.find((it) => it.trackId === next.trackId);
      if (settled) for (const l of settledListeners) l(settled);
    }
  } finally {
    running = false;
  }
}

/** Ajoute des fichiers à la file (un titre = un fichier ; un nouvel envoi remplace l'ancien). */
export function enqueueUploads(list: Array<{ trackId: string; releaseId: string; file: File }>) {
  const ids = new Set(list.map((l) => l.trackId));
  items = [
    ...items.filter((it) => !ids.has(it.trackId)),
    ...list.map((l) => ({ ...l, progress: 0, status: "queued" as const, error: null, networkCut: false })),
  ];
  emit();
  void runQueue();
}

/** « Renvoyer » : reprend un envoi échoué avec le même fichier. */
export function retryUpload(trackId: string) {
  const it = items.find((x) => x.trackId === trackId);
  if (!it || it.status !== "failed") return;
  patch(trackId, { status: "queued", progress: 0, error: null, networkCut: false });
  void runQueue();
}

/** Oublie les envois terminés ou échoués d'une sortie (après relecture du serveur, ou titre retiré). */
export function forgetUploads(trackIds: string[]) {
  const ids = new Set(trackIds);
  const before = items.length;
  items = items.filter((it) => !(ids.has(it.trackId) && (it.status === "done" || it.status === "failed")));
  if (items.length !== before) emit();
}

/** Prévient quand un envoi se termine (réussi ou non) : l'éditeur relit la sortie. */
export function onUploadSettled(listener: (item: UploadItem) => void): () => void {
  settledListeners.add(listener);
  return () => { settledListeners.delete(listener); };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const EMPTY: UploadItem[] = [];

/** Les envois en cours, en attente ou échoués, pour l'écran. */
export function useStudioUploads(): UploadItem[] {
  return useSyncExternalStore(subscribe, () => items, () => EMPTY);
}
