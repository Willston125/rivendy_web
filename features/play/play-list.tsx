"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { useDialogs } from "@/features/ui/dialogs";
import { fetchMyList, setInMyList } from "./play-api";
import { parsePendingListAdd } from "./play-logic";

/**
 * « Ma liste » de Rivendy Play (refonte du 2026-10-22) : la table `play_list`
 * du compte, la même que l'app. Lue UNE fois pour toutes les cartes (chaque
 * bouton relisait toute la liste). Sans compte, l'ajout est gardé le temps de
 * la connexion (`/auth/login?next=`), puis fait au retour — jamais de liste
 * enregistrée dans le navigateur à la place du compte.
 */

const PENDING_KEY = "rivendy_play_pending_list_v1";

type PlayListValue = {
  /** null : pas encore lue (ou visiteur). */
  ids: string[] | null;
  /** La lecture a échoué (panne) : la liste affichée n'est pas fiable. */
  failed: boolean;
  has: (titleId: string) => boolean;
  busy: (titleId: string) => boolean;
  /** Ajoute ou retire ; sans compte, ouvre la connexion et fait l'ajout au retour. */
  toggle: (titleId: string, label: string) => Promise<void>;
  reload: () => void;
};

const PlayListContext = createContext<PlayListValue | null>(null);

export function usePlayList(): PlayListValue {
  const v = useContext(PlayListContext);
  if (!v) throw new Error("usePlayList hors de PlayListProvider");
  return v;
}

export function PlayListProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { notify } = useDialogs();
  const router = useRouter();
  const pathname = usePathname();
  const [ids, setIds] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [round, setRound] = useState(0);
  const resumed = useRef(false);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void fetchMyList()
      .then((list) => { if (alive) { setIds(list); setFailed(false); } })
      .catch(() => { if (alive) { setIds([]); setFailed(true); } });
    return () => { alive = false; };
  }, [userId, round]);

  const write = useCallback(async (titleId: string, on: boolean, label: string): Promise<boolean> => {
    setPending((s) => new Set(s).add(titleId));
    // Affichage immédiat, annulé si le serveur refuse.
    setIds((l) => (l ? (on ? [titleId, ...l.filter((x) => x !== titleId)] : l.filter((x) => x !== titleId)) : l));
    const ok = await setInMyList(titleId, on);
    setPending((s) => { const n = new Set(s); n.delete(titleId); return n; });
    if (!ok) {
      setIds((l) => (l ? (on ? l.filter((x) => x !== titleId) : [titleId, ...l]) : l));
      notify("« Ma liste » n’a pas pu être modifiée. Réessayez.", "error");
      return false;
    }
    const name = label ? `« ${label} »` : "Le titre";
    notify(on ? `${name} est dans Ma liste.` : `${name} a été retiré de Ma liste.`, "success");
    return true;
  }, [notify]);

  // Ajout demandé avant la connexion : fait une fois, dès que la liste est lue.
  useEffect(() => {
    if (!userId || ids === null || resumed.current) return;
    resumed.current = true;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(PENDING_KEY);
      sessionStorage.removeItem(PENDING_KEY);
    } catch { /* stockage fermé : rien à reprendre */ }
    const p = parsePendingListAdd(raw, Date.now());
    if (p && !ids.includes(p.titleId)) void write(p.titleId, true, p.label);
  }, [userId, ids, write]);

  const toggle = useCallback(async (titleId: string, label: string) => {
    if (!userId) {
      if (loading) return;
      try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({ titleId, label: label.slice(0, 120), at: Date.now() }));
      } catch { /* la personne refera son geste après la connexion */ }
      const here = `${pathname || "/play"}${typeof window !== "undefined" ? window.location.search : ""}`;
      router.push(`/auth/login?next=${encodeURIComponent(here)}`);
      return;
    }
    if (pending.has(titleId)) return;
    await write(titleId, !(ids ?? []).includes(titleId), label);
  }, [userId, loading, pathname, router, pending, ids, write]);

  const value = useMemo<PlayListValue>(() => {
    const set = new Set(userId ? ids ?? [] : []);
    return {
      ids: userId ? ids : null,
      failed: !!userId && failed,
      has: (id) => set.has(id),
      busy: (id) => pending.has(id),
      toggle,
      reload: () => setRound((n) => n + 1),
    };
  }, [userId, ids, failed, pending, toggle]);

  return <PlayListContext.Provider value={value}>{children}</PlayListContext.Provider>;
}
