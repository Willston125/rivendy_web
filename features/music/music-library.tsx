"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { ListMusic, Play, Plus, X } from "lucide-react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { useAuth } from "@/features/auth/auth-provider";
import { useDialogs } from "@/features/ui/dialogs";
import {
  addToPlaylist, createPlaylist, fetchLibraryOverview, likedTrackIds, setFollowing, setLiked,
  setReleaseSaved, type LibraryOverview, type Playlist,
} from "./music-api";
import {
  artistName, isValidPlaylistName, latestIso, musicSharePath, releaseKindLabel, samePath,
  type LibraryEntry, type PendingMusicAction,
} from "./music-logic";
import { LoginInviteHost, inviteLogin } from "./music-login-invite";
import { peekPendingPath, takePending } from "./music-pending";
import { useMusicPlayer, type QueueItem } from "./player/music-player-provider";

/**
 * Bibliothèque Musique du compte, partagée par toutes les pages et le
 * lecteur (refonte du 2026-10-22) : titres aimés, playlists, partage, et
 * reprise d'une action commencée sans compte. Les MÊMES lignes que l'app
 * (music_likes, music_playlists…) : rien n'est gardé ailleurs que sur le
 * serveur, hormis l'action en attente le temps de la connexion.
 */

/** Une page qui affiche un état (album enregistré, artiste suivi) l'écoute. */
export const MUSIC_LIBRARY_EVENT = "rivendy:music-library";
export type LibraryEventDetail = { kind: "save" | "follow"; id: string; on: boolean };

type ShareKind = "track" | "release" | "artist" | "playlist";

type LibraryContext = {
  /** Nombre de titres aimés (null tant qu'il n'est pas connu). */
  likeCount: number | null;
  isLiked: (trackId: string) => boolean;
  /** true / false si on le sait, null tant que ce titre n'a pas été vérifié. */
  likeState: (trackId: string) => boolean | null;
  /** Vérifie, une fois, si ces titres sont aimés. */
  ensureLikes: (trackIds: string[]) => void;
  toggleLike: (track: { id: string; title: string }) => Promise<void>;
  playlists: Playlist[] | null;
  /** Toute la bibliothèque du compte (null sans compte ou pendant le chargement). */
  overview: LibraryOverview | null;
  /** Entrées de « Ma bibliothèque » (null sans compte ou pendant le chargement). */
  entries: LibraryEntry[] | null;
  libraryError: boolean;
  refreshLibrary: () => void;
  /** Ancien nom de refreshLibrary. */
  refreshPlaylists: () => void;
  newPlaylist: (thenAdd?: QueueItem) => Promise<Playlist | null>;
  pickPlaylist: (item: QueueItem) => void;
  /** Action réservée aux comptes : une invitation l'explique ; « Se connecter » la garde, on revient. */
  requireLogin: (action: Omit<PendingMusicAction, "at" | "path">, items?: QueueItem[]) => void;
  share: (kind: ShareKind, id: string, title: string) => Promise<void>;
};

const Ctx = createContext<LibraryContext | null>(null);

const PLAYLIST_ERRORS: Record<string, string> = {
  already_in_playlist: "Ce titre est déjà dans la playlist.",
  playlist_full: "Cette playlist est pleine (1 000 titres).",
  playlist_limit: "Vous avez atteint 200 playlists.",
  contact_forbidden: "Une playlist publique ne peut pas contenir de coordonnées.",
  sanctioned: "Votre compte ne peut pas modifier de playlist pour l’instant.",
  playlist_locked: "Cette playlist est bloquée par la modération.",
};
export const playlistMessage = (code: string) => PLAYLIST_ERRORS[code] ?? "Action impossible pour l’instant.";

/** Album enregistré, artiste suivi : les pages et « Ma bibliothèque » se mettent à jour. */
export function emitLibraryChange(detail: LibraryEventDetail) {
  window.dispatchEvent(new CustomEvent<LibraryEventDetail>(MUSIC_LIBRARY_EVENT, { detail }));
}
const emit = emitLibraryChange;

export function MusicLibraryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const dialogs = useDialogs();
  const pathname = usePathname();
  const player = useMusicPlayer();

  const [likes, setLikes] = useState<Map<string, boolean>>(() => new Map());
  const [overview, setOverview] = useState<LibraryOverview | null>(null);
  const [libraryError, setLibraryError] = useState(false);
  const likeCount = overview?.likeCount ?? null;
  const playlists = useMemo(() => (userId ? overview?.playlists ?? null : null), [overview, userId]);
  const [picker, setPicker] = useState<QueueItem | null>(null);
  const [resume, setResume] = useState<{ label: string; items: QueueItem[] } | null>(null);
  const asked = useRef(new Set<string>());

  // ── Compte : tout repart de zéro ─────────────────────────────────────────
  const loadSeq = useRef(0);
  const refreshLibrary = useCallback(() => {
    const seq = ++loadSeq.current;
    if (!userId) { setOverview(null); setLibraryError(false); return; }
    void fetchLibraryOverview()
      .then((o) => { if (seq === loadSeq.current) { setOverview(o); setLibraryError(false); } })
      .catch(() => { if (seq === loadSeq.current) setLibraryError(true); });
  }, [userId]);

  useEffect(() => {
    asked.current = new Set();
    setLikes(new Map());
    setPicker(null);
    setOverview(null);
    refreshLibrary();
  }, [refreshLibrary]);

  // Album enregistré ou artiste suivi ailleurs (page, panneau, reprise) : on relit.
  useEffect(() => {
    const on = () => refreshLibrary();
    window.addEventListener(MUSIC_LIBRARY_EVENT, on);
    return () => window.removeEventListener(MUSIC_LIBRARY_EVENT, on);
  }, [refreshLibrary]);

  const ensureLikes = useCallback((trackIds: string[]) => {
    if (!userId) return;
    const unknown = [...new Set(trackIds)].filter((id) => id && !asked.current.has(id));
    if (unknown.length === 0) return;
    unknown.forEach((id) => asked.current.add(id));
    void likedTrackIds(unknown).then((found) => {
      setLikes((m) => {
        const n = new Map(m);
        for (const id of unknown) if (!n.has(id)) n.set(id, found.has(id));
        return n;
      });
    }).catch(() => unknown.forEach((id) => asked.current.delete(id)));
  }, [userId]);

  const isLiked = useCallback((trackId: string) => likes.get(trackId) === true, [likes]);
  const likeState = useCallback((trackId: string) => (likes.has(trackId) ? likes.get(trackId) === true : null), [likes]);

  const requireLogin = useCallback((action: Omit<PendingMusicAction, "at" | "path">, items?: QueueItem[]) => {
    inviteLogin({ kind: action.kind, label: action.label, action, items });
  }, []);

  const applyLike = useCallback(async (trackId: string, on: boolean): Promise<boolean> => {
    setLikes((m) => new Map(m).set(trackId, on));
    asked.current.add(trackId);
    const ok = await setLiked(trackId, on);
    if (!ok) {
      setLikes((m) => new Map(m).set(trackId, !on));
      return false;
    }
    setOverview((o) => (o ? { ...o, likeCount: Math.max(0, o.likeCount + (on ? 1 : -1)), likedAt: on ? new Date().toISOString() : o.likedAt } : o));
    return true;
  }, []);

  const toggleLike = useCallback(async (track: { id: string; title: string }) => {
    if (!userId) { requireLogin({ kind: "like", id: track.id, label: track.title }); return; }
    const on = likes.get(track.id) !== true;
    const ok = await applyLike(track.id, on);
    if (!ok) { dialogs.notify("Action impossible pour l’instant. Réessayez.", "error"); return; }
    dialogs.notify(on ? "Ajouté à vos favoris" : "Retiré de vos favoris", on ? "success" : "info");
  }, [applyLike, dialogs, likes, requireLogin, userId]);

  const addTo = useCallback(async (p: Playlist, item: QueueItem): Promise<boolean> => {
    const err = await addToPlaylist(p.id, item.track.id);
    if (err) { dialogs.notify(playlistMessage(err), "error"); return false; }
    dialogs.notify(`Ajouté à « ${p.name} »`, "success");
    refreshLibrary();
    return true;
  }, [dialogs, refreshLibrary]);

  const newPlaylist = useCallback(async (thenAdd?: QueueItem): Promise<Playlist | null> => {
    if (!userId) { inviteLogin({ kind: "create" }); return null; }
    const name = await dialogs.ask({ title: "Nouvelle playlist", placeholder: "Nom de la playlist", confirmLabel: "Créer", maxLength: 60 });
    if (name === null) return null;
    if (!isValidPlaylistName(name)) { dialogs.notify("Donnez un nom de 1 à 60 caractères.", "error"); return null; }
    const res = await createPlaylist(name);
    if (res.error || !res.playlist) { dialogs.notify(playlistMessage(res.error ?? ""), "error"); return null; }
    const created = res.playlist;
    if (thenAdd) await addTo(created, thenAdd);
    else { dialogs.notify(`Playlist « ${created.name} » créée`, "success"); refreshLibrary(); }
    return created;
  }, [addTo, dialogs, refreshLibrary, userId]);

  const pickPlaylist = useCallback((item: QueueItem) => {
    if (!userId) { requireLogin({ kind: "playlist", id: item.track.id, label: item.track.title }, [item]); return; }
    setPicker(item);
  }, [requireLogin, userId]);

  const share = useCallback(async (kind: ShareKind, id: string, title: string) => {
    const url = `${window.location.origin}${musicSharePath(kind, id)}`;
    if (typeof navigator.share === "function") {
      try { await navigator.share({ title, url }); return; } catch (e) {
        if ((e as DOMException)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      dialogs.notify("Lien copié", "success");
    } catch {
      dialogs.notify(url, "info");
    }
  }, [dialogs]);

  // ── Reprise de l'action commencée sans compte ────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const path = peekPendingPath();
    if (!path || !samePath(path, pathname)) return;
    const pending = takePending<QueueItem>();
    if (!pending) return;
    const { action, items } = pending;
    void (async () => {
      switch (action.kind) {
        case "like": {
          const ok = await applyLike(action.id, true);
          dialogs.notify(ok ? `« ${action.label || "Le titre"} » est dans vos favoris` : "Action impossible pour l’instant.", ok ? "success" : "error");
          break;
        }
        case "save": {
          const ok = await setReleaseSaved(action.id, true);
          if (ok) emit({ kind: "save", id: action.id, on: true });
          dialogs.notify(ok ? "Enregistré dans votre bibliothèque" : "Action impossible pour l’instant.", ok ? "success" : "error");
          break;
        }
        case "follow": {
          const err = await setFollowing(action.id, true);
          if (!err) emit({ kind: "follow", id: action.id, on: true });
          dialogs.notify(!err ? `Vous suivez ${action.label || "cet artiste"}` : "Action impossible pour l’instant.", !err ? "success" : "error");
          break;
        }
        case "playlist":
          if (items[0]?.track?.id === action.id) setPicker(items[0]);
          break;
        case "play":
          // Le navigateur exige un geste pour lancer le son : on le propose.
          if (items.length > 0) setResume({ label: action.label, items });
          break;
      }
    })();
  }, [applyLike, dialogs, pathname, userId]);

  const entries = useMemo(() => (userId && overview ? libraryEntries(overview) : null), [overview, userId]);

  const value = useMemo<LibraryContext>(() => ({
    likeCount, isLiked, likeState, ensureLikes, toggleLike, playlists, overview, entries, libraryError, refreshLibrary,
    refreshPlaylists: refreshLibrary, newPlaylist, pickPlaylist, requireLogin, share,
  }), [likeCount, isLiked, likeState, ensureLikes, toggleLike, playlists, overview, entries, libraryError, refreshLibrary, newPlaylist,
    pickPlaylist, requireLogin, share]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <LoginInviteHost />
      {picker ? (
        <PlaylistPicker item={picker} playlists={playlists} onClose={() => setPicker(null)}
          onPick={async (p) => { if (await addTo(p, picker)) setPicker(null); }}
          onCreate={async () => { const item = picker; setPicker(null); await newPlaylist(item); }} />
      ) : null}
      {resume ? (
        <div role="status" className="rvm-scope fixed inset-x-4 bottom-24 z-[46] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-rvm-line bg-rvm-raised p-3 text-rvm-text shadow-2xl">
          <span className="min-w-0 flex-1 text-sm">
            Vous vouliez écouter <span className="font-semibold">« {resume.label || "ce titre"} »</span>
          </span>
          <button type="button" onClick={() => { player.playQueue(resume.items, 0); setResume(null); }}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-rvm-accent px-4 text-sm font-bold text-rvm-on-accent hover:bg-rvm-accent-hover active:bg-rvm-accent-pressed">
            <Play className="h-4 w-4 fill-current" aria-hidden /> Écouter
          </button>
          <button type="button" onClick={() => setResume(null)} aria-label="Plus tard"
            className="flex h-10 w-10 items-center justify-center rounded-full text-rvm-muted hover:bg-white/10 hover:text-rvm-text">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}

/**
 * Entrées de « Ma bibliothèque » à partir des données du compte : « Titres
 * likés » (épinglé), playlists, albums enregistrés, artistes suivis. La
 * dernière utilisation = dernière écoute connue ou dernière modification.
 */
function libraryEntries(o: LibraryOverview): LibraryEntry[] {
  const n = (k: number) => `${k} titre${k > 1 ? "s" : ""}`;
  return [
    {
      key: "liked", kind: "liked", id: "liked", title: "Titres likés", subtitle: `Playlist • ${n(o.likeCount)}`,
      href: "/music/favorites", cover: null, addedAt: o.likedAt, usedAt: o.likedAt, pinned: true,
    },
    ...o.playlists.map((p): LibraryEntry => ({
      key: `playlist:${p.id}`, kind: "playlist", id: p.id, title: p.name,
      subtitle: `Playlist • ${n(p.music_playlist_items?.[0]?.count ?? 0)}`,
      href: `/music/playlist/${p.id}`, cover: p.covers[0] ?? null, covers: p.covers,
      addedAt: p.updated_at, usedAt: p.updated_at,
    })),
    ...o.albums.map(({ release: r, savedAt }): LibraryEntry => ({
      key: `album:${r.id}`, kind: "album", id: r.id, title: r.title,
      subtitle: `${releaseKindLabel(r.kind)} • ${artistName(r)}`, href: `/music/album/${r.id}`, cover: r.cover_url ?? null,
      addedAt: savedAt, usedAt: latestIso(savedAt, o.lastPlayedByRelease[r.id]),
    })),
    ...o.artists.map(({ artist: a, followedAt }): LibraryEntry => ({
      key: `artist:${a.id}`, kind: "artist", id: a.id, title: a.name, subtitle: "Artiste",
      href: `/artist/${a.id}`, cover: a.avatar_url ?? null,
      addedAt: followedAt || null, usedAt: latestIso(followedAt, o.lastPlayedByArtist[a.id]),
    })),
  ];
}

export function useMusicLibrary(): LibraryContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMusicLibrary doit être utilisé dans MusicLibraryProvider");
  return ctx;
}

/** Fenêtre sombre « Ajouter à une playlist » (feuille du bas sur téléphone). */
function PlaylistPicker({ item, playlists, onClose, onPick, onCreate }: {
  item: QueueItem;
  playlists: Playlist[] | null;
  onClose: () => void;
  onPick: (p: Playlist) => void;
  onCreate: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <DialogShell onClose={onClose} labelledBy="rvm-playlist-picker-title" layerClassName="z-[70]"
      panelClassName="rvm-scope w-full max-w-md rounded-t-3xl border border-rvm-line bg-rvm-surface p-5 text-rvm-text shadow-2xl sm:rounded-3xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="rvm-playlist-picker-title" className="text-lg font-bold">Ajouter à une playlist</h2>
          <p className="mt-0.5 truncate text-sm text-rvm-muted">{item.track.title}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-rvm-muted hover:bg-white/10 hover:text-rvm-text">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <button type="button" onClick={onCreate}
        className="mt-4 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/5">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-rvm-accent text-rvm-on-accent"><Plus className="h-5 w-5" aria-hidden /></span>
        <span className="font-semibold">Nouvelle playlist</span>
      </button>
      <ul className="mt-1 max-h-72 overflow-y-auto">
        {playlists === null ? <li className="px-2 py-3 text-sm text-rvm-muted">Chargement…</li>
          : playlists.length === 0 ? <li className="px-2 py-3 text-sm text-rvm-muted">Aucune playlist pour l’instant.</li>
          : playlists.map((p) => (
            <li key={p.id}>
              <button type="button" disabled={busy !== null}
                onClick={async () => { setBusy(p.id); await onPick(p); setBusy(null); }}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/5 disabled:opacity-60">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-rvm-raised text-rvm-muted"><ListMusic className="h-5 w-5" aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="block text-xs text-rvm-muted">
                    {p.music_playlist_items?.[0]?.count ?? 0} titre{(p.music_playlist_items?.[0]?.count ?? 0) > 1 ? "s" : ""} · {p.is_public ? "publique" : "privée"}
                  </span>
                </span>
                {busy === p.id ? <span className="text-xs text-rvm-muted">Ajout…</span> : null}
              </button>
            </li>
          ))}
      </ul>
    </DialogShell>
  );
}
