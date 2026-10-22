"use client";

import { parsePendingAction, type PendingMusicAction } from "./music-logic";

/**
 * Action Musique demandée sans compte (refonte du 2026-10-22) : gardée dans
 * l'onglet le temps de la connexion (`/auth/login?next=`), puis reprise sur
 * la page d'origine par MusicLibraryProvider. Jamais rien d'autre qu'un
 * identifiant et un libellé : la reprise relit tout sur le serveur.
 */
const KEY = "rivendy_music_pending_v1";
const ITEMS_KEY = "rivendy_music_pending_items_v1";

export function savePending<T>(action: Omit<PendingMusicAction, "at">, items?: T[]): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...action, at: Date.now() }));
    if (items && items.length) sessionStorage.setItem(ITEMS_KEY, JSON.stringify(items.slice(0, 50)));
    else sessionStorage.removeItem(ITEMS_KEY);
  } catch { /* stockage indisponible : la personne recommencera son geste */ }
}

/** Lit ET efface l'action (une seule reprise). */
export function takePending<T>(): { action: PendingMusicAction; items: T[] } | null {
  try {
    const action = parsePendingAction(sessionStorage.getItem(KEY), Date.now());
    const raw = sessionStorage.getItem(ITEMS_KEY);
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(ITEMS_KEY);
    if (!action) return null;
    let items: T[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) items = parsed as T[];
      } catch { /* liste illisible : l'action reste */ }
    }
    return { action, items };
  } catch {
    return null;
  }
}

export function peekPendingPath(): string | null {
  try {
    return parsePendingAction(sessionStorage.getItem(KEY), Date.now())?.path ?? null;
  } catch {
    return null;
  }
}

/** Page de connexion qui ramène ici. */
export function loginHref(path: string): string {
  return `/auth/login?next=${encodeURIComponent(path || "/music")}`;
}
