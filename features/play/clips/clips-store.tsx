"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { useHomeMarket } from "@/features/media/use-home-market";
import { setFollowing } from "@/features/music/music-api";
import { useDialogs } from "@/features/ui/dialogs";
import {
  fetchClipArtists, fetchClipCounts, fetchClips, fetchFollowedIds, fetchMyArtist, type Clip, type MyArtist,
} from "./clips-api";
import { artistStatusOf, parsePendingClipAction, type ArtistStatus, type ClipArtist, type ClipCounts } from "./clips-logic";

/**
 * Rivendy Clips — données partagées par la coque et les pages (refonte du
 * 2026-10-26). Le catalogue du marché (clips, compteurs, artistes) est lu UNE
 * fois, à la première page Clips ouverte, puis gardé : revenir d'un clip à la
 * grille ne relit rien, la grille réapparaît telle quelle. Les abonnements du
 * compte sont lus une fois aussi. Rien n'est lu tant qu'aucune page Clips ne
 * le demande (les films et les séries n'en paient pas le prix).
 */

export type CatalogState =
  | { status: "idle" | "loading" }
  | { status: "error" }
  | { status: "ready"; clips: Clip[]; counts: Record<string, ClipCounts>; artists: Record<string, ClipArtist> };

type ClipsValue = {
  market: string | null;
  catalog: CatalogState;
  /** Demande le catalogue du marché (sans effet s'il est déjà lu ou en cours). */
  ensureCatalog: () => void;
  retryCatalog: () => void;
  /** Corrige un compteur affiché après un J'aime (le serveur reste la référence). */
  patchCounts: (id: string, patch: Partial<ClipCounts>) => void;
  /** Ajoute un clip lu à part (lien direct) au catalogue gardé. */
  rememberArtist: (a: ClipArtist) => void;
  follows: { ids: Set<string> | null; failed: boolean; busy: (userId: string) => boolean; toggle: (userId: string, name: string) => Promise<void> };
  artist: { status: ArtistStatus | null; profile: MyArtist | null };
  search: { requestFocus: () => void; focusRequested: boolean; consumeFocus: () => void; inputRef: RefObject<HTMLInputElement | null> };
};

const ClipsContext = createContext<ClipsValue | null>(null);

export function useClips(): ClipsValue {
  const v = useContext(ClipsContext);
  if (!v) throw new Error("useClips hors de ClipsProvider");
  return v;
}

/** Le catalogue du marché, demandé au premier affichage de la page. */
export function useClipsCatalog(): { market: string | null; catalog: CatalogState; retry: () => void } {
  const { market, catalog, ensureCatalog, retryCatalog } = useClips();
  useEffect(() => { ensureCatalog(); }, [ensureCatalog]);
  return { market, catalog, retry: retryCatalog };
}

const FOLLOW_KEY = "rivendy_clips_pending_follow_v1";

export function ClipsProvider({ children }: { children: ReactNode }) {
  const market = useHomeMarket();
  const { user, loading: authLoading } = useAuth();
  const { notify } = useDialogs();
  const router = useRouter();
  const pathname = usePathname();
  const userId = user?.id ?? null;

  // ── Catalogue ─────────────────────────────────────────────────────────────
  const [wanted, setWanted] = useState(false);
  const [round, setRound] = useState(0);
  const [data, setData] = useState<{ key: string; state: CatalogState } | null>(null);
  const key = market && wanted ? `${market}:${round}` : null;

  useEffect(() => {
    if (!key || !market) return;
    let alive = true;
    setData({ key, state: { status: "loading" } });
    void (async () => {
      try {
        const clips = await fetchClips(market);
        const [counts, artists] = await Promise.all([
          fetchClipCounts(clips.map((c) => c.id)),
          fetchClipArtists(clips.map((c) => c.artist_id ?? "").filter(Boolean)),
        ]);
        if (alive) setData({ key, state: { status: "ready", clips, counts, artists } });
      } catch {
        if (alive) setData({ key, state: { status: "error" } });
      }
    })();
    return () => { alive = false; };
  }, [key, market]);

  const catalog = useMemo<CatalogState>(
    () => (!market ? { status: "idle" } : data && data.key === key ? data.state : { status: wanted ? "loading" : "idle" }),
    [market, data, key, wanted],
  );
  const ensureCatalog = useCallback(() => setWanted(true), []);
  const retryCatalog = useCallback(() => { setWanted(true); setRound((n) => n + 1); }, []);
  const patchCounts = useCallback((id: string, patch: Partial<ClipCounts>) => {
    setData((d) => {
      if (!d || d.state.status !== "ready") return d;
      const cur = d.state.counts[id] ?? { views: 0, likes: 0 };
      return { ...d, state: { ...d.state, counts: { ...d.state.counts, [id]: { ...cur, ...patch } } } };
    });
  }, []);
  const rememberArtist = useCallback((a: ClipArtist) => {
    setData((d) => (d && d.state.status === "ready" && !d.state.artists[a.id]
      ? { ...d, state: { ...d.state, artists: { ...d.state.artists, [a.id]: a } } } : d));
  }, []);

  // ── Abonnements du compte ─────────────────────────────────────────────────
  const [followed, setFollowed] = useState<{ user: string; ids: Set<string> | null; failed: boolean } | null>(null);
  const [followBusy, setFollowBusy] = useState<Set<string>>(() => new Set());
  const resumed = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void fetchFollowedIds()
      .then((ids) => { if (alive) setFollowed({ user: userId, ids: new Set(ids), failed: false }); })
      .catch(() => { if (alive) setFollowed({ user: userId, ids: new Set(), failed: true }); });
    return () => { alive = false; };
  }, [userId]);

  const followIds = userId && followed?.user === userId ? followed.ids : null;

  const writeFollow = useCallback(async (personId: string, on: boolean, name: string) => {
    setFollowBusy((s) => new Set(s).add(personId));
    const apply = (v: boolean) => setFollowed((f) => {
      if (!f || !f.ids) return f;
      const ids = new Set(f.ids);
      if (v) ids.add(personId); else ids.delete(personId);
      return { ...f, ids };
    });
    apply(on);
    const err = await setFollowing(personId, on);
    setFollowBusy((s) => { const n = new Set(s); n.delete(personId); return n; });
    if (err) {
      apply(!on);
      notify(err === "blocked" ? "Action impossible avec ce compte." : "Action impossible pour l’instant. Réessayez.", "error");
      return;
    }
    notify(on ? `Vous suivez ${name}.` : `Vous ne suivez plus ${name}.`, "success");
  }, [notify]);

  // Abonnement demandé avant la connexion : fait une fois, au retour.
  useEffect(() => {
    if (!userId || !followIds || resumed.current) return;
    resumed.current = true;
    let raw: string | null = null;
    try { raw = sessionStorage.getItem(FOLLOW_KEY); sessionStorage.removeItem(FOLLOW_KEY); } catch { /* stockage fermé */ }
    const p = parsePendingClipAction(raw, Date.now());
    if (p?.kind === "follow" && !followIds.has(p.id) && p.id !== userId) void writeFollow(p.id, true, "cet artiste");
  }, [userId, followIds, writeFollow]);

  const toggleFollow = useCallback(async (personId: string, name: string) => {
    if (!userId) {
      if (authLoading) return;
      try { sessionStorage.setItem(FOLLOW_KEY, JSON.stringify({ kind: "follow", id: personId, at: Date.now() })); } catch { /* refait après connexion */ }
      const here = `${pathname || "/play/clips"}${typeof window !== "undefined" ? window.location.search : ""}`;
      notify("Connectez-vous pour suivre cet artiste : vous retrouverez ses nouveaux clips dans Abonnements.", "info");
      router.push(`/auth/login?next=${encodeURIComponent(here)}`);
      return;
    }
    if (personId === userId || followBusy.has(personId)) return;
    await writeFollow(personId, !(followIds?.has(personId) ?? false), name);
  }, [userId, authLoading, pathname, router, notify, followBusy, followIds, writeFollow]);

  // ── Profil artiste du compte (bouton « Publier un clip » / « Espace artiste ») ──
  const [mine, setMine] = useState<{ user: string; profile: MyArtist | null; ok: boolean } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void fetchMyArtist()
      .then((p) => { if (alive) setMine({ user: userId, profile: p, ok: true }); })
      .catch(() => { if (alive) setMine({ user: userId, profile: null, ok: false }); });
    return () => { alive = false; };
  }, [userId]);
  const myArtist = userId && mine?.user === userId ? mine : null;

  // ── Recherche : la loupe du téléphone donne le focus au champ de la page ──
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [focusRequested, setFocusRequested] = useState(false);

  const value = useMemo<ClipsValue>(() => ({
    market,
    catalog,
    ensureCatalog,
    retryCatalog,
    patchCounts,
    rememberArtist,
    follows: {
      ids: followIds,
      failed: !!userId && !!followed?.failed,
      busy: (id) => followBusy.has(id),
      toggle: toggleFollow,
    },
    artist: {
      status: !userId ? "none" : myArtist ? (myArtist.ok ? artistStatusOf(myArtist.profile?.status) : "none") : null,
      profile: myArtist?.profile ?? null,
    },
    search: {
      inputRef,
      focusRequested,
      requestFocus: () => setFocusRequested(true),
      consumeFocus: () => setFocusRequested(false),
    },
  }), [market, catalog, ensureCatalog, retryCatalog, patchCounts, rememberArtist, followIds, userId, followed, followBusy, toggleFollow, myArtist, focusRequested]);

  return <ClipsContext.Provider value={value}>{children}</ClipsContext.Provider>;
}
