"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, ListPlus, Lock, Music2, Play, Plus, X } from "lucide-react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { useAuth } from "@/features/auth/auth-provider";
import { useDialogs } from "@/features/ui/dialogs";
import { cn } from "@/lib/utils/cn";
import {
  addToPlaylist, createPlaylist, fetchMyPlaylists, likedTrackIds, setLiked, type Playlist,
} from "./music-api";
import {
  artistName, formatDuration, isPlayable, isValidPlaylistName, releaseKindLabel, thumbUrl, trackSubtitle,
  type MusicRelease, type MusicTrack,
} from "./music-logic";
import { useMusicPlayer, type QueueItem } from "./player/music-player-provider";

/** Couleurs de Rivendy Music (celles de l'app : fond nuit, or). */
export const MUSIC = {
  bg: "bg-[#0D0B19]",
  card: "bg-[#1F1A36]",
  gold: "text-[#F5B83D]",
  goldBg: "bg-[#F5B83D]",
} as const;

export function Cover({ url, size, alt, className, rounded = "rounded-xl" }: {
  url: string | null | undefined; size: 160 | 320 | 480 | 720; alt: string; className?: string; rounded?: string;
}) {
  const src = thumbUrl(url, size);
  if (!src || !src.startsWith("https://")) {
    return (
      <div className={cn("flex aspect-square items-center justify-center bg-[#2A2346] text-[#F5B83D]", rounded, className)}>
        <Music2 className="h-1/3 w-1/3" />
      </div>
    );
  }
  return (
    <Image src={src} alt={alt} width={size} height={size} unoptimized
      className={cn("aspect-square object-cover", rounded, className)} />
  );
}

export function PremiumTag() {
  return <span className="rounded bg-[#F5B83D]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#F5B83D]">Premium</span>;
}

/** Grille de sorties (albums, singles, EP). */
export function ReleaseGrid({ releases }: { releases: MusicRelease[] }) {
  if (releases.length === 0) return <p className="text-sm text-white/60">Rien pour l’instant.</p>;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {releases.map((r) => (
        <Link key={r.id} href={`/music/album/${r.id}`} className="group min-w-0">
          <Cover url={r.cover_url} size={320} alt={r.title} className="w-full transition group-hover:opacity-90" />
          <p className="mt-2 truncate text-sm font-semibold text-white">{r.title}</p>
          <p className="truncate text-xs text-white/60">
            {artistName(r)} · {releaseKindLabel(r.kind)}{r.is_premium ? " · Premium" : ""}
          </p>
        </Link>
      ))}
    </div>
  );
}

/** Liste de titres jouable (sortie, playlist, favoris, historique, Hit). */
export function TrackList({ items, showCover = false, numbered = true, extra }: {
  items: QueueItem[];
  showCover?: boolean;
  numbered?: boolean;
  extra?: (item: QueueItem, i: number) => React.ReactNode;
}) {
  const { user } = useAuth();
  const player = useMusicPlayer();
  const dialogs = useDialogs();
  const [liked, setLikedIds] = useState<Set<string>>(new Set());
  const [pickFor, setPickFor] = useState<QueueItem | null>(null);
  const ids = items.map((x) => x.track.id).join(",");

  useEffect(() => {
    if (!user || !ids) return;
    let alive = true;
    void likedTrackIds(ids.split(",")).then((s) => { if (alive) setLikedIds(s); });
    return () => { alive = false; };
  }, [user, ids]);

  async function toggleLike(t: MusicTrack) {
    if (!user) { dialogs.notify("Connectez-vous pour aimer un titre.", "info"); return; }
    const on = !liked.has(t.id);
    const ok = await setLiked(t.id, on);
    if (!ok) { dialogs.notify("Action impossible pour l’instant.", "error"); return; }
    setLikedIds((s) => { const n = new Set(s); if (on) n.add(t.id); else n.delete(t.id); return n; });
  }

  return (
    <>
      <ol className="divide-y divide-white/5">
        {items.map((item, i) => {
          const { track: t, release: r } = item;
          const playable = isPlayable(t);
          const isCurrent = player.current?.track.id === t.id;
          const locked = !!r.is_premium && !t.is_free;
          return (
            <li key={`${t.id}-${i}`} className={cn("group flex items-center gap-3 py-2", isCurrent && "text-[#F5B83D]")}>
              <button type="button" disabled={!playable} onClick={() => player.playQueue(items, i)}
                aria-label={`Écouter ${t.title}`}
                className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-50">
                {showCover ? <Cover url={r.cover_url} size={160} alt="" className="h-11 w-11 shrink-0" rounded="rounded-md" />
                  : numbered ? <span className="w-6 shrink-0 text-right text-sm text-white/50">{t.position}</span> : null}
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm font-semibold", isCurrent ? "text-[#F5B83D]" : "text-white")}>
                    {t.title}{t.explicit ? <span className="ml-1 rounded bg-white/15 px-1 text-[10px]">E</span> : null}
                  </span>
                  <span className="block truncate text-xs text-white/60">{trackSubtitle(t, r)}</span>
                </span>
                {!playable ? <span className="text-xs text-white/50">Bientôt</span>
                  : locked ? <Lock className="h-3.5 w-3.5 text-[#F5B83D]" aria-label="Premium" />
                  : r.is_premium && t.is_free ? <span className="text-xs text-[#F5B83D]">Offert</span> : null}
                <span className="w-12 shrink-0 text-right text-xs text-white/50">{formatDuration(t.duration_seconds)}</span>
              </button>
              {extra ? extra(item, i) : null}
              <button type="button" onClick={() => toggleLike(t)} aria-label={liked.has(t.id) ? "Ne plus aimer" : "Aimer"}
                className="rounded-full p-1.5 text-white/60 hover:text-white">
                <Heart className={cn("h-4 w-4", liked.has(t.id) && "fill-[#F5B83D] text-[#F5B83D]")} />
              </button>
              <button type="button" disabled={!playable} onClick={() => player.addToQueue(item)} aria-label="Ajouter à la file d’attente"
                className="hidden rounded-full p-1.5 text-white/60 hover:text-white disabled:opacity-30 sm:block">
                <ListPlus className="h-4 w-4" />
              </button>
              <button type="button" disabled={!playable} onClick={() => (user ? setPickFor(item) : dialogs.notify("Connectez-vous pour créer des playlists.", "info"))}
                aria-label="Ajouter à une playlist" className="rounded-full p-1.5 text-white/60 hover:text-white disabled:opacity-30">
                <Plus className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ol>
      {pickFor ? <PlaylistPicker item={pickFor} onClose={() => setPickFor(null)} /> : null}
    </>
  );
}

const PLAYLIST_ERRORS: Record<string, string> = {
  already_in_playlist: "Ce titre est déjà dans la playlist.",
  playlist_full: "Cette playlist est pleine (1 000 titres).",
  playlist_limit: "Vous avez atteint 200 playlists.",
  contact_forbidden: "Une playlist publique ne peut pas contenir de coordonnées.",
  sanctioned: "Votre compte ne peut pas modifier de playlist pour l’instant.",
  playlist_locked: "Cette playlist est bloquée par la modération.",
};
export const playlistMessage = (code: string) => PLAYLIST_ERRORS[code] ?? "Action impossible pour l’instant.";

function PlaylistPicker({ item, onClose }: { item: QueueItem; onClose: () => void }) {
  const dialogs = useDialogs();
  const [lists, setLists] = useState<Playlist[] | null>(null);
  const [name, setName] = useState("");
  useEffect(() => { void fetchMyPlaylists().then(setLists); }, []);

  async function add(p: Playlist) {
    const err = await addToPlaylist(p.id, item.track.id);
    if (err) { dialogs.notify(playlistMessage(err), "error"); return; }
    dialogs.notify(`Ajouté à « ${p.name} »`, "success");
    onClose();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPlaylistName(name)) return;
    const res = await createPlaylist(name);
    if (res.error || !res.playlist) { dialogs.notify(playlistMessage(res.error ?? ""), "error"); return; }
    await add(res.playlist);
  }

  return (
    <DialogShell onClose={onClose} labelledBy="playlist-picker-title">
      <div className="flex items-center justify-between">
        <h2 id="playlist-picker-title" className="text-lg font-bold text-slate-950">Ajouter à une playlist</h2>
        <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-full p-1 text-slate-500"><X className="h-5 w-5" /></button>
      </div>
      <p className="mt-1 truncate text-sm text-slate-500">{item.track.title}</p>
      <form onSubmit={create} className="mt-4 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Nouvelle playlist"
          className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm" />
        <button type="submit" disabled={!isValidPlaylistName(name)}
          className="rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-40">Créer</button>
      </form>
      <ul className="mt-3 max-h-64 overflow-y-auto">
        {lists === null ? <li className="py-2 text-sm text-slate-500">Chargement…</li>
          : lists.length === 0 ? <li className="py-2 text-sm text-slate-500">Aucune playlist pour l’instant.</li>
          : lists.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => add(p)} className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50">
                {p.name} <span className="text-xs text-slate-400">· {p.music_playlist_items?.[0]?.count ?? 0} titres</span>
              </button>
            </li>
          ))}
      </ul>
    </DialogShell>
  );
}

/** Bouton « Écouter » d'une page (sortie, playlist, artiste…). */
export function PlayAllButton({ items, label = "Écouter" }: { items: QueueItem[]; label?: string }) {
  const player = useMusicPlayer();
  const playable = items.filter((x) => isPlayable(x.track));
  return (
    <button type="button" disabled={playable.length === 0} onClick={() => player.playQueue(items, 0)}
      className="inline-flex items-center gap-2 rounded-full bg-[#F5B83D] px-5 py-2.5 text-sm font-bold text-[#0D0B19] disabled:opacity-40">
      <Play className="h-4 w-4 fill-current" /> {label}
    </button>
  );
}

/** Titres → éléments de file (chaque titre porte sa sortie). */
export function toQueue(tracks: MusicTrack[], release?: MusicRelease | null): QueueItem[] {
  return tracks
    .map((t) => ({ track: t, release: (release ?? t.music_releases) as MusicRelease }))
    .filter((x) => !!x.release);
}

/** Section sombre des pages Musique. */
export function MusicPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("min-h-screen bg-[#0D0B19] text-white", className)}>
    <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
  </div>;
}

/** Barre de liens de la section (accueil, Hit, recherche, bibliothèque). */
export function MusicNav() {
  const links = [
    { href: "/music", label: "Accueil" },
    { href: "/music/hit", label: "Rivendy Hit" },
    { href: "/music/search", label: "Recherche" },
    { href: "/music/library", label: "Ma musique" },
  ];
  return (
    <nav className="mb-6 flex flex-wrap gap-2 text-sm">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="rounded-full bg-white/10 px-3 py-1.5 font-semibold text-white hover:bg-white/15">{l.label}</Link>
      ))}
    </nav>
  );
}
