"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Globe, Heart, ListMusic, Lock, Pencil, Plus, Share2, Trash2 } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useDialogs } from "@/features/ui/dialogs";
import { cn } from "@/lib/utils/cn";
import {
  clearHistory, deletePlaylist, fetchFollowedArtists, fetchHistory, fetchLikedTracks, fetchPlaylist, fetchSavedReleases,
  removeFromPlaylist, updatePlaylist,
} from "./music-api";
import { playlistMessage, useMusicLibrary } from "./music-library";
import { isValidPlaylistName, releaseMeta, type MusicTrack } from "./music-logic";
import {
  ArtistCard, CardRowSkeleton, Cover, EmptyState, ErrorState, ListSkeleton, PageTitle, PlayAllButton, ReleaseGrid,
  TrackList, iconButton, secondaryButton, toQueue, useLoad,
} from "./music-ui";

/**
 * Pages du compte (refonte du 2026-10-22) : bibliothèque, favoris,
 * historique, playlist. Mêmes lignes que l'app : une playlist renommée ici
 * l'est aussi sur le téléphone.
 */

/** En-tête d'une liste personnelle : visuel, titre, chiffres réels, actions. */
function ListHeader({ visual, kicker, title, meta, children }: {
  visual: React.ReactNode; kicker: string; title: string; meta?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-rvm-line bg-gradient-to-br from-rvm-brand/25 via-rvm-surface to-rvm-surface">
      <div className="relative flex flex-col gap-6 p-5 sm:p-8 md:flex-row md:items-end">
        <div className="w-40 shrink-0 sm:w-48">{visual}</div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-rvm-accent">{kicker}</p>
          <h1 className="mt-2 break-words text-3xl font-black leading-tight tracking-tight sm:text-5xl">{title}</h1>
          {meta ? <div className="mt-2 text-sm text-rvm-soft">{meta}</div> : null}
          {children ? <div className="mt-5 flex flex-wrap items-center gap-3">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}

function IconTile({ icon: Icon }: { icon: typeof Heart }) {
  return (
    <div className="flex aspect-square items-center justify-center rounded-2xl bg-gradient-to-br from-rvm-accent to-rvm-brand shadow-2xl shadow-black/50">
      <Icon className="h-1/3 w-1/3 fill-rvm-on-accent/10 text-rvm-on-accent" aria-hidden />
    </div>
  );
}

/** Mosaïque des 4 premières pochettes d'une playlist. */
function Mosaic({ tracks }: { tracks: MusicTrack[] }) {
  const covers = [...new Set(tracks.map((t) => t.music_releases?.cover_url).filter((u): u is string => !!u))].slice(0, 4);
  if (covers.length < 4) {
    return covers[0]
      ? <Cover url={covers[0]} size={480} alt="" className="w-full shadow-2xl shadow-black/50" rounded="rounded-2xl" />
      : <IconTile icon={ListMusic} />;
  }
  return (
    <div className="grid aspect-square grid-cols-2 overflow-hidden rounded-2xl shadow-2xl shadow-black/50">
      {covers.map((u) => <Cover key={u} url={u} size={320} alt="" rounded="rounded-none" className="w-full" />)}
    </div>
  );
}

// ── Ma bibliothèque ────────────────────────────────────────────────────────

export function LibraryView() {
  const library = useMusicLibrary();
  const [tab, setTab] = useState<"playlists" | "albums" | "artists">("playlists");
  const albums = useLoad(tab === "albums" ? "albums" : null, () => fetchSavedReleases());
  const artists = useLoad(tab === "artists" ? "artists" : null, () => fetchFollowedArtists());
  const tabs = [["playlists", "Playlists"], ["albums", "Albums"], ["artists", "Artistes"]] as const;

  return (
    <>
      <PageTitle title="Ma bibliothèque" subtitle="Vos playlists, albums et artistes — les mêmes que dans l’application." />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Link href="/music/favorites" className="flex items-center gap-4 rounded-2xl border border-rvm-line bg-gradient-to-r from-rvm-brand/30 to-rvm-surface p-4 hover:border-rvm-accent/60">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rvm-accent text-rvm-on-accent"><Heart className="h-5 w-5 fill-current" aria-hidden /></span>
          <span>
            <span className="block font-bold">Mes favoris</span>
            <span className="block text-sm text-rvm-muted">
              {library.likeCount === null ? "Vos titres aimés" : `${library.likeCount} titre${library.likeCount > 1 ? "s" : ""}`}
            </span>
          </span>
        </Link>
        <Link href="/music/history" className="flex items-center gap-4 rounded-2xl border border-rvm-line bg-rvm-surface p-4 hover:border-rvm-accent/60">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rvm-raised text-rvm-accent"><Clock className="h-5 w-5" aria-hidden /></span>
          <span>
            <span className="block font-bold">Écoutés récemment</span>
            <span className="block text-sm text-rvm-muted">Sur le site et dans l’application</span>
          </span>
        </Link>
      </div>

      <div role="tablist" aria-label="Ma bibliothèque" className="mt-8 flex gap-1 border-b border-rvm-line">
        {tabs.map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            className={cn("-mb-px h-11 border-b-2 px-4 text-sm font-semibold transition-colors",
              tab === v ? "border-rvm-accent text-rvm-text" : "border-transparent text-rvm-muted hover:text-rvm-text")}>{l}</button>
        ))}
      </div>

      <div role="tabpanel" className="mt-6">
        {tab === "playlists" ? (
          library.playlists === null ? <CardRowSkeleton count={4} /> : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              <li>
                <button type="button" onClick={() => void library.newPlaylist()}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-rvm-line text-rvm-soft hover:border-rvm-accent hover:text-rvm-accent">
                  <Plus className="h-8 w-8" aria-hidden />
                  <span className="text-sm font-semibold">Nouvelle playlist</span>
                </button>
              </li>
              {library.playlists.map((p) => {
                const n = p.music_playlist_items?.[0]?.count ?? 0;
                return (
                  <li key={p.id}>
                    <Link href={`/music/playlist/${p.id}`} className="group block">
                      <div className="flex aspect-square items-center justify-center rounded-2xl bg-gradient-to-br from-rvm-brand/45 to-rvm-raised text-rvm-text shadow-lg shadow-black/30 transition group-hover:from-rvm-accent/60">
                        <ListMusic className="h-1/3 w-1/3" aria-hidden />
                      </div>
                      <span className="mt-2.5 block truncate text-sm font-semibold group-hover:text-rvm-accent">{p.name}</span>
                      <span className="block text-xs text-rvm-muted">{n} titre{n > 1 ? "s" : ""} · {p.is_public ? "publique" : "privée"}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )
        ) : tab === "albums" ? (
          albums.error ? <ErrorState onRetry={albums.reload} />
            : !albums.data ? <CardRowSkeleton count={5} />
            : <ReleaseGrid releases={albums.data} empty="Aucun album enregistré. Touchez « Enregistrer » sur une sortie pour la retrouver ici." />
        ) : (
          artists.error ? <ErrorState onRetry={artists.reload} />
            : !artists.data ? <CardRowSkeleton count={5} round />
            : artists.data.length === 0 ? <p className="text-sm text-rvm-muted">Vous ne suivez aucun artiste pour l’instant.</p>
            : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {artists.data.map((a) => <ArtistCard key={a.id} artist={a} />)}
              </div>
            )
        )}
      </div>
    </>
  );
}

// ── Mes favoris ────────────────────────────────────────────────────────────

export function FavoritesView() {
  const liked = useLoad("liked", () => fetchLikedTracks());
  const queue = useMemo(() => toQueue(liked.data ?? []), [liked.data]);
  return (
    <>
      <ListHeader visual={<IconTile icon={Heart} />} kicker="Playlist" title="Mes favoris"
        meta={liked.data ? releaseMeta(liked.data) : "Les titres que vous aimez, sur le site et dans l’application."}>
        <PlayAllButton items={queue} />
      </ListHeader>
      <div className="mt-8">
        {liked.error ? <ErrorState onRetry={liked.reload} />
          : !liked.data ? <ListSkeleton rows={6} />
          : queue.length === 0 ? (
            <EmptyState icon={Heart} title="Aucun titre aimé pour l’instant"
              text="Touchez le cœur d’un titre pour le retrouver ici, sur le site et dans l’application."
              action={<Link href="/music" className={secondaryButton}>Découvrir des titres</Link>} />
          ) : <TrackList items={queue} label="Mes favoris" />}
      </div>
    </>
  );
}

// ── Écoutés récemment ──────────────────────────────────────────────────────

export function HistoryView() {
  const dialogs = useDialogs();
  const history = useLoad("history", () => fetchHistory());
  const [cleared, setCleared] = useState(false);
  const rows = useMemo(() => (cleared ? [] : history.data), [cleared, history.data]);
  const queue = useMemo(() => toQueue((rows ?? []).map((r) => r.track)), [rows]);

  async function clear() {
    const ok = await dialogs.confirm({ title: "Effacer l’historique ?", message: "Sur le site et dans l’application.", confirmLabel: "Effacer", danger: true });
    if (!ok) return;
    if (await clearHistory()) setCleared(true); else dialogs.notify("Action impossible pour l’instant.", "error");
  }

  return (
    <>
      <PageTitle title="Écoutés récemment"
        subtitle="Les titres écoutés au moins 30 secondes, sur le site et dans l’application (90 derniers jours)."
        aside={rows && rows.length > 0 ? (
          <button type="button" onClick={clear} className={cn(secondaryButton, "h-10")}>
            <Trash2 className="h-4 w-4" aria-hidden /> Effacer
          </button>
        ) : undefined} />
      <div className="mt-6">
        {history.error ? <ErrorState onRetry={history.reload} />
          : !rows ? <ListSkeleton rows={6} />
          : queue.length === 0 ? <EmptyState icon={Clock} title="Rien pour l’instant" text="Vos écoutes apparaîtront ici." />
          : (
            <>
              <PlayAllButton items={queue} />
              <div className="mt-6"><TrackList items={queue} label="Écoutés récemment" /></div>
            </>
          )}
      </div>
    </>
  );
}

// ── Playlist ───────────────────────────────────────────────────────────────

export function PlaylistView({ id }: { id: string }) {
  const { user } = useAuth();
  const dialogs = useDialogs();
  const router = useRouter();
  const library = useMusicLibrary();
  const page = useLoad(`playlist:${id}:${user?.id ?? ""}`, () => fetchPlaylist(id));
  const [patch, setPatch] = useState<{ name?: string; is_public?: boolean }>({});
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());

  const playlist = page.data?.playlist ? { ...page.data.playlist, ...patch } : null;
  const tracks = useMemo(() => (page.data?.tracks ?? []).filter((t) => !removed.has(t.id)), [page.data, removed]);
  const queue = useMemo(() => toQueue(tracks), [tracks]);
  const mine = !!user && playlist?.owner_id === user.id;

  if (page.error) return <ErrorState onRetry={page.reload} />;
  if (!page.data) return <ListSkeleton rows={8} />;
  if (!playlist) {
    return <EmptyState icon={Lock} title="Cette playlist est privée ou n’existe plus"
      action={<Link href="/music" className={secondaryButton}>Retour à la musique</Link>} />;
  }

  async function rename() {
    if (!playlist) return;
    const name = await dialogs.ask({ title: "Renommer la playlist", placeholder: playlist.name, confirmLabel: "Renommer", maxLength: 60 });
    if (name === null) return;
    if (!isValidPlaylistName(name)) { dialogs.notify("Donnez un nom de 1 à 60 caractères.", "error"); return; }
    const err = await updatePlaylist(id, { name: name.trim() });
    if (err) { dialogs.notify(playlistMessage(err), "error"); return; }
    setPatch((p) => ({ ...p, name: name.trim() }));
    library.refreshPlaylists();
  }

  async function togglePublic() {
    if (!playlist) return;
    const err = await updatePlaylist(id, { is_public: !playlist.is_public });
    if (err) { dialogs.notify(playlistMessage(err), "error"); return; }
    setPatch((p) => ({ ...p, is_public: !playlist.is_public }));
    dialogs.notify(playlist.is_public ? "La playlist est privée" : "La playlist est publique : son lien peut être partagé", "success");
    library.refreshPlaylists();
  }

  async function remove() {
    const ok = await dialogs.confirm({ title: "Supprimer cette playlist ?", message: "Sur le site et dans l’application.", confirmLabel: "Supprimer", danger: true });
    if (!ok) return;
    if (await deletePlaylist(id)) { library.refreshPlaylists(); router.push("/music/library"); }
    else dialogs.notify("Suppression impossible.", "error");
  }

  async function removeTrack(trackId: string) {
    if (await removeFromPlaylist(id, trackId)) {
      setRemoved((s) => new Set(s).add(trackId));
      library.refreshPlaylists();
    } else dialogs.notify("Action impossible pour l’instant.", "error");
  }

  return (
    <>
      <ListHeader visual={<Mosaic tracks={tracks} />} kicker={`Playlist ${playlist.is_public ? "publique" : "privée"}`} title={playlist.name}
        meta={<>{playlist.description ? <p className="mb-1 text-rvm-soft">{playlist.description}</p> : null}{releaseMeta(tracks)}</>}>
        <PlayAllButton items={queue} />
        {mine ? (
          <>
            <button type="button" onClick={rename} className={cn(secondaryButton, "h-10 px-4")}><Pencil className="h-4 w-4" aria-hidden /> Renommer</button>
            <button type="button" onClick={togglePublic} aria-pressed={playlist.is_public} className={cn(secondaryButton, "h-10 px-4")}>
              {playlist.is_public ? <Lock className="h-4 w-4" aria-hidden /> : <Globe className="h-4 w-4" aria-hidden />}
              {playlist.is_public ? "Rendre privée" : "Rendre publique"}
            </button>
            <button type="button" onClick={remove} aria-label="Supprimer la playlist"
              className={cn(iconButton, "h-10 w-10 border border-red-300/30 text-red-300 hover:bg-red-500/10 hover:text-red-200")}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </>
        ) : null}
        {playlist.is_public ? (
          <button type="button" onClick={() => void library.share("playlist", id, playlist.name)} aria-label="Partager la playlist"
            className={cn(iconButton, "h-10 w-10 border border-white/15")}>
            <Share2 className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </ListHeader>
      <div className="mt-8">
        {queue.length === 0 ? (
          <EmptyState icon={ListMusic} title="Cette playlist est vide"
            text={mine ? "Ajoutez des titres avec le menu « … » d’un titre, ici ou dans l’application." : undefined}
            action={mine ? <Link href="/music/explore" className={secondaryButton}>Trouver des titres</Link> : undefined} />
        ) : (
          <TrackList items={queue} label={`Titres de ${playlist.name}`}
            menuExtra={mine ? (item) => [{ label: "Retirer de cette playlist", icon: Trash2, danger: true, onSelect: () => void removeTrack(item.track.id) }] : undefined} />
        )}
      </div>
    </>
  );
}
