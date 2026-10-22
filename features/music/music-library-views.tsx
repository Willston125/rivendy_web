"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Clock, Globe, Heart, ListMusic, Lock, Pencil, Share2, Trash2, type LucideIcon } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useDialogs } from "@/features/ui/dialogs";
import { cn } from "@/lib/utils/cn";
import {
  clearHistory, deletePlaylist, fetchHistory, fetchLikedTracks, fetchPlaylist, removeFromPlaylist, updatePlaylist,
} from "./music-api";
import { CollectionPage, IconTile, LIKED_TINT, MetaLine, PlaylistCover, useCoverTint } from "./music-collection";
import { playlistMessage, useMusicLibrary } from "./music-library";
import { LibraryPanel } from "./music-library-panel";
import { isValidPlaylistName, totalDurationLabel, type MusicTrack } from "./music-logic";
import { loginHref } from "./music-pending";
import {
  EmptyState, ErrorState, ListSkeleton, PlayAllButton, ShuffleButton, TrackList, iconButton, primaryButton,
  secondaryButton, toQueue, useLoad,
} from "./music-ui";

/**
 * Pages du compte (mise en page application du 2026-10-22) : Ma
 * bibliothèque (téléphone), titres likés, historique, playlist. Grand
 * en-tête, commandes de lecture dessous, colonne de date. Mêmes lignes que
 * l'app : une playlist renommée ici l'est aussi sur le téléphone.
 */

const countLabel = (n: number) => `${n} titre${n > 1 ? "s" : ""}`;
const seconds = (tracks: MusicTrack[]) => tracks.reduce((s, t) => s + Number(t.duration_seconds ?? 0), 0);

/** Sans compte : une invitation dans le thème de la Musique (pas la page claire du site). */
function AccountOnly({ icon, title, text, children }: { icon: LucideIcon; title: string; text: string; children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname() || "/music";
  if (loading) return <div className="p-4 @2xl:p-6"><ListSkeleton rows={6} /></div>;
  if (!user) {
    return (
      <div className="px-4 py-8 @2xl:px-6">
        <EmptyState icon={icon} title={title} text={text}
          action={<Link href={loginHref(pathname)} className={primaryButton}>Se connecter</Link>} />
      </div>
    );
  }
  return <>{children}</>;
}

// ── Ma bibliothèque (téléphone ; sur ordinateur elle est à gauche) ─────────

export function LibraryView() {
  return <LibraryPanel variant="page" />;
}

// ── Titres likés ───────────────────────────────────────────────────────────

export function FavoritesView() {
  return (
    <AccountOnly icon={Heart} title="Vos titres likés vous attendent"
      text="Connectez-vous pour retrouver les titres que vous aimez, sur le site et dans l’application.">
      <Favorites />
    </AccountOnly>
  );
}

function Favorites() {
  const { user, profile } = useAuth();
  const library = useMusicLibrary();
  const liked = useLoad(user ? `liked:${user.id}` : null, () => fetchLikedTracks());
  // Un titre retiré des favoris (ici, dans le lecteur…) quitte la liste aussitôt.
  const tracks = useMemo(() => (liked.data ?? []).filter((t) => library.likeState(t.id) !== false), [liked.data, library]);
  const queue = useMemo(() => toQueue(tracks), [tracks]);
  const total = seconds(tracks);
  const owner = profile?.full_name?.trim();
  const source = { label: "Titres likés", href: "/music/favorites" };

  return (
    <CollectionPage tint={LIKED_TINT} kicker="Playlist" title="Titres likés" cover={<IconTile icon={Heart} />}
      meta={<MetaLine parts={[
        owner ? <span className="font-bold">{owner}</span> : null,
        liked.data ? countLabel(tracks.length) : null,
        total ? totalDurationLabel(total) : null,
      ]} />}
      compactActions={<PlayAllButton items={queue} source={source} variant="round" className="h-11 w-11" />}
      actions={(
        <>
          <PlayAllButton items={queue} source={source} variant="round" />
          <ShuffleButton items={queue} source={source} />
        </>
      )}>
      {liked.error ? <ErrorState onRetry={liked.reload} />
        : !liked.data ? <ListSkeleton rows={6} />
        : queue.length === 0 ? (
          <EmptyState icon={Heart} title="Aucun titre liké pour l’instant"
            text="Touchez le cœur d’un titre pour le retrouver ici, sur le site et dans l’application."
            action={<Link href="/music" className={secondaryButton}>Découvrir des titres</Link>} />
        ) : <TrackList items={queue} label="Titres likés" source={source} dateLabel="Date d’ajout" stickyHeader />}
    </CollectionPage>
  );
}

// ── Écoutés récemment ──────────────────────────────────────────────────────

export function HistoryView() {
  return (
    <AccountOnly icon={Clock} title="Votre historique d’écoute"
      text="Connectez-vous pour retrouver les titres écoutés sur le site et dans l’application.">
      <History />
    </AccountOnly>
  );
}

function History() {
  const { user } = useAuth();
  const dialogs = useDialogs();
  const history = useLoad(user ? `history:${user.id}` : null, () => fetchHistory());
  const [cleared, setCleared] = useState(false);
  // La colonne de date affiche la dernière écoute.
  const tracks = useMemo(
    () => (cleared ? [] : (history.data ?? []).map((r) => ({ ...r.track, added_at: r.last_played_at }))),
    [cleared, history.data],
  );
  const queue = useMemo(() => toQueue(tracks), [tracks]);
  const loaded = cleared || !!history.data;
  const source = { label: "Écoutés récemment", href: "/music/history" };

  async function clear() {
    const ok = await dialogs.confirm({ title: "Effacer l’historique ?", message: "Sur le site et dans l’application.", confirmLabel: "Effacer", danger: true });
    if (!ok) return;
    if (await clearHistory()) setCleared(true); else dialogs.notify("Action impossible pour l’instant.", "error");
  }

  return (
    <CollectionPage tint={null} kicker="Historique" title="Écoutés récemment" cover={<IconTile icon={Clock} tone="night" />}
      description="Les titres écoutés au moins 30 secondes, sur le site et dans l’application (90 derniers jours)."
      meta={loaded ? <MetaLine parts={[countLabel(queue.length)]} /> : null}
      compactActions={<PlayAllButton items={queue} source={source} variant="round" className="h-11 w-11" />}
      actions={(
        <>
          <PlayAllButton items={queue} source={source} variant="round" />
          <ShuffleButton items={queue} source={source} />
          {queue.length > 0 ? (
            <button type="button" onClick={clear} className={cn(secondaryButton, "ml-auto h-9 px-4")}>
              <Trash2 className="h-4 w-4" aria-hidden /> Effacer l’historique
            </button>
          ) : null}
        </>
      )}>
      {history.error ? <ErrorState onRetry={history.reload} />
        : !loaded ? <ListSkeleton rows={6} />
        : queue.length === 0 ? <EmptyState icon={Clock} title="Rien pour l’instant" text="Vos écoutes apparaîtront ici." />
        : <TrackList items={queue} label="Écoutés récemment" source={source} dateLabel="Écouté" stickyHeader />}
    </CollectionPage>
  );
}

// ── Playlist ───────────────────────────────────────────────────────────────

export function PlaylistView({ id }: { id: string }) {
  const { user, profile } = useAuth();
  const dialogs = useDialogs();
  const router = useRouter();
  const library = useMusicLibrary();
  const page = useLoad(`playlist:${id}:${user?.id ?? ""}`, () => fetchPlaylist(id));
  const [patch, setPatch] = useState<{ name?: string; is_public?: boolean }>({});
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());

  const playlist = page.data?.playlist ? { ...page.data.playlist, ...patch } : null;
  const tracks = useMemo(() => (page.data?.tracks ?? []).filter((t) => !removed.has(t.id)), [page.data, removed]);
  const queue = useMemo(() => toQueue(tracks), [tracks]);
  const covers = useMemo(
    () => [...new Set(tracks.map((t) => t.music_releases?.cover_url).filter((u): u is string => !!u))].slice(0, 4),
    [tracks],
  );
  const tint = useCoverTint(covers[0]);
  const mine = !!user && playlist?.owner_id === user.id;

  if (page.error) return <div className="p-4 @2xl:p-6"><ErrorState onRetry={page.reload} /></div>;
  if (!page.data) return <div className="p-4 @2xl:p-6"><ListSkeleton rows={8} /></div>;
  if (!playlist) {
    return (
      <div className="px-4 py-8 @2xl:px-6">
        <EmptyState icon={Lock} title="Cette playlist est privée ou n’existe plus"
          action={<Link href="/music" className={secondaryButton}>Retour à la musique</Link>} />
      </div>
    );
  }

  async function rename() {
    if (!playlist) return;
    const name = await dialogs.ask({ title: "Renommer la playlist", placeholder: playlist.name, confirmLabel: "Renommer", maxLength: 60 });
    if (name === null) return;
    if (!isValidPlaylistName(name)) { dialogs.notify("Donnez un nom de 1 à 60 caractères.", "error"); return; }
    const err = await updatePlaylist(id, { name: name.trim() });
    if (err) { dialogs.notify(playlistMessage(err), "error"); return; }
    setPatch((p) => ({ ...p, name: name.trim() }));
    library.refreshLibrary();
  }

  async function togglePublic() {
    if (!playlist) return;
    const err = await updatePlaylist(id, { is_public: !playlist.is_public });
    if (err) { dialogs.notify(playlistMessage(err), "error"); return; }
    setPatch((p) => ({ ...p, is_public: !playlist.is_public }));
    dialogs.notify(playlist.is_public ? "La playlist est privée" : "La playlist est publique : son lien peut être partagé", "success");
    library.refreshLibrary();
  }

  async function remove() {
    const ok = await dialogs.confirm({ title: "Supprimer cette playlist ?", message: "Sur le site et dans l’application.", confirmLabel: "Supprimer", danger: true });
    if (!ok) return;
    if (await deletePlaylist(id)) { library.refreshLibrary(); router.push("/music/library"); }
    else dialogs.notify("Suppression impossible.", "error");
  }

  async function removeTrack(trackId: string) {
    if (await removeFromPlaylist(id, trackId)) {
      setRemoved((s) => new Set(s).add(trackId));
      library.refreshLibrary();
    } else dialogs.notify("Action impossible pour l’instant.", "error");
  }

  const total = seconds(tracks);
  const owner = mine ? profile?.full_name?.trim() : null;
  const source = { label: playlist.name, href: `/music/playlist/${id}` };
  const tool = cn(iconButton, "h-12 w-12 text-rvm-soft");

  return (
    <CollectionPage tint={tint} kicker={playlist.is_public ? "Playlist publique" : "Playlist privée"} title={playlist.name}
      cover={<PlaylistCover covers={covers} />}
      description={playlist.description}
      meta={<MetaLine parts={[
        owner ? <span className="font-bold">{owner}</span> : null,
        countLabel(tracks.length),
        total ? totalDurationLabel(total) : null,
      ]} />}
      compactActions={<PlayAllButton items={queue} source={source} variant="round" className="h-11 w-11" />}
      actions={(
        <>
          <PlayAllButton items={queue} source={source} variant="round" />
          <ShuffleButton items={queue} source={source} />
          {playlist.is_public ? (
            <button type="button" onClick={() => void library.share("playlist", id, playlist.name)} aria-label="Partager la playlist"
              title="Partager" className={tool}>
              <Share2 className="h-6 w-6" aria-hidden />
            </button>
          ) : null}
          {mine ? (
            <>
              <button type="button" onClick={rename} aria-label="Renommer la playlist" title="Renommer" className={tool}>
                <Pencil className="h-5 w-5" aria-hidden />
              </button>
              <button type="button" onClick={togglePublic} aria-pressed={playlist.is_public}
                aria-label={playlist.is_public ? "Rendre la playlist privée" : "Rendre la playlist publique"}
                title={playlist.is_public ? "Rendre privée" : "Rendre publique"} className={tool}>
                {playlist.is_public ? <Lock className="h-5 w-5" aria-hidden /> : <Globe className="h-5 w-5" aria-hidden />}
              </button>
              <button type="button" onClick={remove} aria-label="Supprimer la playlist" title="Supprimer"
                className={cn(tool, "hover:bg-red-500/10 hover:text-red-300")}>
                <Trash2 className="h-5 w-5" aria-hidden />
              </button>
            </>
          ) : null}
        </>
      )}>
      {queue.length === 0 ? (
        <EmptyState icon={ListMusic} title="Cette playlist est vide"
          text={mine ? "Ajoutez des titres avec le menu « … » d’un titre, ici ou dans l’application." : undefined}
          action={mine ? <Link href="/music/explore" className={secondaryButton}>Trouver des titres</Link> : undefined} />
      ) : (
        <TrackList items={queue} label={`Titres de ${playlist.name}`} source={source} dateLabel="Date d’ajout" stickyHeader
          menuExtra={mine ? (item) => [{ label: "Retirer de cette playlist", icon: Trash2, danger: true, onSelect: () => void removeTrack(item.track.id) }] : undefined} />
      )}
    </CollectionPage>
  );
}
