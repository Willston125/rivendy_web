"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { fetchProgress, fetchTitlesByIds } from "./play-api";
import { usePlayList } from "./play-list";
import type { PlayTitle, WatchProgress } from "./play-logic";

/**
 * Lectures du compte partagées par l'accueil et les pages de Rivendy Play.
 * Mêmes tables que l'app (lot C) : une position ou Ma liste enregistrées ici
 * se retrouvent dans l'app, et inversement.
 */

const NO_PROGRESS: WatchProgress[] = [];

/** Positions du compte (reprise, barres d'avancement). */
export function useProgress(): WatchProgress[] {
  const { user } = useAuth();
  const [progress, setProgress] = useState<WatchProgress[]>(NO_PROGRESS);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void fetchProgress().then((p) => { if (alive) setProgress(p); });
    return () => { alive = false; };
  }, [user]);
  return user ? progress : NO_PROGRESS;
}

/**
 * Titres de « Ma liste » (la liste du compte, lue une fois par PlayListProvider),
 * dans l'ordre de la liste. Un titre retiré du catalogue garde une entrée
 * vide : il n'est plus redemandé.
 */
export function useMyListTitles(): { titles: PlayTitle[]; waiting: boolean; failed: boolean; retry: () => void } {
  const list = usePlayList();
  const [byId, setById] = useState<Record<string, PlayTitle>>({});
  const [failed, setFailed] = useState(false);
  const ids = list.ids;
  const missing = useMemo(() => (ids ?? []).filter((id) => !byId[id]), [ids, byId]);

  useEffect(() => {
    if (missing.length === 0) return;
    let alive = true;
    void fetchTitlesByIds(missing)
      .then((found) => {
        if (!alive) return;
        setById((m) => ({ ...m, ...Object.fromEntries(missing.map((id) => [id, found.find((t) => t.id === id) ?? ({ id, kind: "", title: "" } as PlayTitle)])) }));
        setFailed(false);
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [missing]);

  const titles = (ids ?? []).map((id) => byId[id]).filter((t): t is PlayTitle => !!t && !!t.title);
  return {
    titles,
    waiting: ids !== null && missing.length > 0 && !failed,
    failed: list.failed || failed,
    retry: () => { setFailed(false); list.reload(); },
  };
}
