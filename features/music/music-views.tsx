"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Heart, Library, Loader2, Lock, Plus, Search, Trash2, UserCheck, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { useDialogs } from "@/features/ui/dialogs";
import { fetchHomeMarketId } from "@/features/products/publish-market-dialog";
import { appIntentUrl } from "@/features/play/play-link-page";
import { cn } from "@/lib/utils/cn";
import {
  clearHistory, createPlaylist, deletePlaylist, fetchArtistTopTracks, fetchFeatured, fetchFollowedArtists,
  fetchHistory, fetchHit, fetchLikedTracks, fetchMyPlaylists, fetchNewReleases, fetchPlaylist, fetchRelease,
  fetchReleasesByArtist, fetchSavedReleases, isFollowing, isReleaseSaved, removeFromPlaylist, searchMusic,
  setFollowing, setReleaseSaved, updatePlaylist, fetchTracksByIds,
  type HitRow, type MusicArtist, type Playlist, type SearchRow,
} from "./music-api";
import {
  artistName, hitMovement, isValidPlaylistName, releaseKindLabel, releaseMeta, searchable,
  type MusicRelease, type MusicTrack,
} from "./music-logic";
import { Cover, MusicNav, MusicPage, PlayAllButton, PremiumTag, ReleaseGrid, TrackList, playlistMessage, toQueue } from "./music-ui";

/** Marché d'écoute : marché d'origine du compte, sinon le pays choisi (comme l'app). */
export function useMusicMarket(): string | null {
  const { user } = useAuth();
  const { country } = useCountry();
  const [home, setHome] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void fetchHomeMarketId(supabase, user.id).then((m) => { if (alive) setHome(m); });
    return () => { alive = false; };
  }, [user]);
  return (user ? home : null) ?? country?.id ?? null;
}

function Spinner() {
  return <div className="py-10 text-center text-white/60"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;
}

function Section({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-xl font-black">{title}</h2>
        {href ? <Link href={href} className="text-sm font-semibold text-[#F5B83D] hover:underline">Tout voir</Link> : null}
      </div>
      {children}
    </section>
  );
}

// ── Accueil ────────────────────────────────────────────────────────────────

export function MusicHomeView() {
  const market = useMusicMarket();
  const { user } = useAuth();
  const [featured, setFeatured] = useState<MusicRelease[] | null>(null);
  const [fresh, setFresh] = useState<MusicRelease[] | null>(null);
  const [hit, setHit] = useState<HitRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([fetchFeatured(market), fetchNewReleases(market, 24), fetchHit("all", "", market)])
      .then(([f, n, h]) => { if (alive) { setFeatured(f); setFresh(n); setHit(h); } });
    return () => { alive = false; };
  }, [market]);

  const hitQueue = useMemo(() => toQueue((hit ?? []).map((h) => h.music_tracks).filter((t): t is MusicTrack => !!t)), [hit]);

  return (
    <MusicPage>
      <header className="rounded-3xl bg-gradient-to-br from-[#2A2346] to-[#0D0B19] px-6 py-8">
        <p className="text-sm font-bold uppercase tracking-widest text-[#F5B83D]">Rivendy Musique</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Le son des Comores et d’ailleurs</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/70">
          Singles, EP et albums des artistes Rivendy. La même bibliothèque que dans l’application, avec le même compte.
        </p>
      </header>
      <div className="mt-6"><MusicNav /></div>
      {!user ? (
        <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-white/80">
          <Link href="/auth/login?next=/music" className="font-bold text-[#F5B83D] underline">Connectez-vous</Link> pour écouter, aimer des titres et créer vos playlists.
        </p>
      ) : null}

      {featured === null ? <Spinner /> : (
        <>
          {featured.length > 0 ? <Section title="À la une"><ReleaseGrid releases={featured.slice(0, 10)} /></Section> : null}
          <Section title="Rivendy Hit" href="/music/hit">
            {hitQueue.length === 0 ? <p className="text-sm text-white/60">Le classement de la semaine arrive bientôt.</p>
              : <TrackList items={hitQueue.slice(0, 5)} showCover numbered={false} />}
          </Section>
          <Section title="Nouveautés"><ReleaseGrid releases={fresh ?? []} /></Section>
        </>
      )}
    </MusicPage>
  );
}

// ── Sortie (album, single, EP) ─────────────────────────────────────────────

export function AlbumView({ release, tracks, highlight }: { release: MusicRelease; tracks: MusicTrack[]; highlight?: string | null }) {
  const { user } = useAuth();
  const dialogs = useDialogs();
  const [saved, setSaved] = useState(false);
  const queue = useMemo(() => toQueue(tracks, release), [tracks, release]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void isReleaseSaved(release.id).then((v) => { if (alive) setSaved(v); });
    return () => { alive = false; };
  }, [user, release.id]);

  useEffect(() => {
    if (!highlight) return;
    document.getElementById(`t-${highlight}`)?.scrollIntoView({ block: "center" });
  }, [highlight]);

  async function toggleSave() {
    if (!user) { dialogs.notify("Connectez-vous pour enregistrer cet album.", "info"); return; }
    const ok = await setReleaseSaved(release.id, !saved);
    if (ok) setSaved(!saved); else dialogs.notify("Action impossible pour l’instant.", "error");
  }

  const year = release.release_date?.slice(0, 4) ?? release.published_at?.slice(0, 4) ?? "";
  return (
    <MusicPage>
      <MusicNav />
      <div className="flex flex-col gap-6 md:flex-row md:items-end">
        <Cover url={release.cover_url} size={720} alt={release.title} className="w-56 shadow-2xl md:w-64" />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-[#F5B83D]">{releaseKindLabel(release.kind)}</p>
          <h1 className="mt-1 text-3xl font-black sm:text-4xl">{release.title}</h1>
          <p className="mt-2 text-white/70">
            {release.artist_id ? <Link href={`/artist/${release.artist_id}`} className="font-semibold text-white hover:underline">{artistName(release)}</Link> : artistName(release)}
            {year ? ` · ${year}` : ""} · {releaseMeta(tracks)}
          </p>
          <div className="mt-2 flex gap-2">{release.is_premium ? <PremiumTag /> : null}{release.explicit ? <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-bold">E</span> : null}</div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <PlayAllButton items={queue} />
            <button type="button" onClick={toggleSave}
              className={cn("rounded-full border px-4 py-2 text-sm font-semibold", saved ? "border-[#F5B83D] text-[#F5B83D]" : "border-white/30 text-white")}>
              {saved ? "Enregistré" : "Enregistrer"}
            </button>
            <a href={appIntentUrl(`/musique/release/${release.id}`)} className="text-sm text-white/60 underline md:hidden">Ouvrir dans l’application</a>
          </div>
          {release.is_premium ? (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-white/60">
              <Lock className="h-3.5 w-3.5 text-[#F5B83D]" /> Sortie Premium : écoute complète avec <Link href="/plus" className="font-semibold text-[#F5B83D] underline">Rivendy+</Link>, extraits de 30 s sinon.
            </p>
          ) : null}
        </div>
      </div>
      {release.description ? <p className="mt-6 max-w-3xl whitespace-pre-line text-sm text-white/70">{release.description}</p> : null}
      <div className="mt-8">
        <TrackList items={queue} extra={(item) => <span id={`t-${item.track.id}`} className={cn(highlight === item.track.id && "h-2 w-2 rounded-full bg-[#F5B83D]")} />} />
      </div>
    </MusicPage>
  );
}

// ── Rivendy Hit ────────────────────────────────────────────────────────────

export function HitView() {
  const market = useMusicMarket();
  const [scope, setScope] = useState<"all" | "country">("all");
  const [rows, setRows] = useState<HitRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    void fetchHit(scope, scope === "all" ? "" : market ?? "", market).then((r) => { if (alive) setRows(r); });
    return () => { alive = false; setRows(null); };
  }, [scope, market]);
  const queue = useMemo(() => toQueue((rows ?? []).map((h) => h.music_tracks).filter((t): t is MusicTrack => !!t)), [rows]);
  const byTrack = useMemo(() => new Map((rows ?? []).map((h) => [h.music_tracks?.id ?? "", h])), [rows]);

  return (
    <MusicPage>
      <MusicNav />
      <h1 className="text-3xl font-black">Rivendy Hit</h1>
      <p className="mt-1 text-sm text-white/60">Le classement de la semaine, selon le nombre d’auditeurs.</p>
      <div className="mt-4 flex gap-2">
        {([["all", "Général"], ["country", "Mon pays"]] as const).map(([v, l]) => (
          <button key={v} type="button" onClick={() => setScope(v)} aria-pressed={scope === v}
            className={cn("rounded-full px-3 py-1.5 text-sm font-semibold", scope === v ? "bg-[#F5B83D] text-[#0D0B19]" : "bg-white/10 text-white")}>{l}</button>
        ))}
      </div>
      <div className="mt-6">
        {rows === null ? <Spinner /> : queue.length === 0 ? <p className="text-sm text-white/60">Pas encore de classement pour cette semaine.</p> : (
          <>
            <PlayAllButton items={queue} label="Écouter le Hit" />
            <div className="mt-4">
              <TrackList items={queue} showCover numbered={false} extra={(item) => {
                const h = byTrack.get(item.track.id);
                if (!h) return null;
                return (
                  <span className="flex w-20 shrink-0 items-center justify-end gap-2 text-xs">
                    <span className={cn("font-black", h.rank <= 3 ? "text-[#F5B83D]" : "text-white/70")}>#{h.rank}</span>
                    <span className="text-white/50">{hitMovement(h.rank, h.previous_rank)}</span>
                  </span>
                );
              }} />
            </div>
          </>
        )}
      </div>
    </MusicPage>
  );
}

// ── Recherche ──────────────────────────────────────────────────────────────

export function SearchView() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SearchRow[] | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!searchable(q)) return;
    let alive = true;
    const t = window.setTimeout(() => { void searchMusic(q).then((r) => { if (alive) setRows(r); }); }, 350);
    return () => { alive = false; window.clearTimeout(t); };
  }, [q]);

  async function open(r: SearchRow) {
    if (r.kind === "release") { router.push(`/music/album/${r.id}`); return; }
    if (r.kind === "artist") { router.push(`/artist/${r.id}`); return; }
    if (r.kind === "track") {
      setOpening(true);
      const [t] = await fetchTracksByIds([r.id]);
      setOpening(false);
      router.push(t ? `/music/album/${t.release_id}?t=${t.id}` : `/music/album/${r.release_id}`);
      return;
    }
    router.push(`/musique/podcast/${r.id}`);
  }

  const kinds: Array<[SearchRow["kind"], string]> = [["artist", "Artistes"], ["release", "Albums et singles"], ["track", "Titres"], ["podcast", "Podcasts"]];
  return (
    <MusicPage>
      <MusicNav />
      <label className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3">
        <Search className="h-5 w-5 text-white/60" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Artiste, titre, album…"
          className="min-w-0 flex-1 bg-transparent text-white placeholder:text-white/40 focus:outline-none" />
        {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      </label>
      {!searchable(q) ? <p className="mt-6 text-sm text-white/60">Tapez au moins 2 caractères.</p>
        : rows === null ? <Spinner />
        : rows.length === 0 ? <p className="mt-6 text-sm text-white/60">Aucun résultat.</p>
        : kinds.map(([k, label]) => {
          const list = rows.filter((r) => r.kind === k);
          if (list.length === 0) return null;
          return (
            <Section key={k} title={label}>
              <ul className="grid gap-2 sm:grid-cols-2">
                {list.map((r) => (
                  <li key={`${r.kind}-${r.id}`}>
                    <button type="button" onClick={() => open(r)} className="flex w-full items-center gap-3 rounded-xl bg-white/5 p-2 text-left hover:bg-white/10">
                      <Cover url={r.cover_url} size={160} alt="" className="h-12 w-12 shrink-0" rounded={k === "artist" ? "rounded-full" : "rounded-md"} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{r.title}</span>
                        {r.subtitle ? <span className="block truncate text-xs text-white/60">{r.subtitle}</span> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          );
        })}
    </MusicPage>
  );
}

// ── Artiste ────────────────────────────────────────────────────────────────

export function ArtistView({ artist }: { artist: MusicArtist }) {
  const { user } = useAuth();
  const dialogs = useDialogs();
  const market = useMusicMarket();
  const [top, setTop] = useState<MusicTrack[] | null>(null);
  const [releases, setReleases] = useState<MusicRelease[] | null>(null);
  const [following, setFollowingState] = useState(false);

  useEffect(() => {
    let alive = true;
    void Promise.all([fetchArtistTopTracks(artist.id, market), fetchReleasesByArtist(artist.id, market)])
      .then(([t, r]) => { if (alive) { setTop(t); setReleases(r); } });
    return () => { alive = false; };
  }, [artist.id, market]);

  useEffect(() => {
    if (!user || !artist.user_id) return;
    let alive = true;
    void isFollowing(artist.user_id).then((v) => { if (alive) setFollowingState(v); });
    return () => { alive = false; };
  }, [user, artist.user_id]);

  async function toggleFollow() {
    if (!user) { dialogs.notify("Connectez-vous pour suivre cet artiste.", "info"); return; }
    if (!artist.user_id) return;
    const err = await setFollowing(artist.user_id, !following);
    if (err) { dialogs.notify(err === "blocked" ? "Action impossible avec ce compte." : "Action impossible pour l’instant.", "error"); return; }
    setFollowingState(!following);
  }

  const queue = useMemo(() => toQueue(top ?? []), [top]);
  return (
    <MusicPage>
      <MusicNav />
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-end">
        <Cover url={artist.avatar_url} size={480} alt={artist.name} className="w-40" rounded="rounded-full" />
        <div className="min-w-0 text-center sm:text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-[#F5B83D]">Artiste</p>
          <h1 className="text-3xl font-black sm:text-4xl">{artist.name}</h1>
          {artist.genre ? <p className="mt-1 text-sm text-white/60">{artist.genre}</p> : null}
          <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
            <PlayAllButton items={queue} />
            {artist.user_id ? (
              <button type="button" onClick={toggleFollow}
                className={cn("inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold",
                  following ? "border-[#F5B83D] text-[#F5B83D]" : "border-white/30 text-white")}>
                {following ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />} {following ? "Abonné" : "Suivre"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {artist.bio ? <p className="mt-6 max-w-3xl whitespace-pre-line text-sm text-white/70">{artist.bio}</p> : null}
      <Section title="Titres populaires">
        {top === null ? <Spinner /> : queue.length === 0 ? <p className="text-sm text-white/60">Pas encore de titres populaires.</p>
          : <TrackList items={queue} showCover numbered={false} />}
      </Section>
      <Section title="Sorties">{releases === null ? <Spinner /> : <ReleaseGrid releases={releases} />}</Section>
    </MusicPage>
  );
}

// ── Ma musique : playlists, albums enregistrés, artistes suivis ────────────

export function LibraryView() {
  const dialogs = useDialogs();
  const [tab, setTab] = useState<"playlists" | "albums" | "artists">("playlists");
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
  const [albums, setAlbums] = useState<MusicRelease[] | null>(null);
  const [artists, setArtists] = useState<MusicArtist[] | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    let alive = true;
    if (tab === "playlists") void fetchMyPlaylists().then((x) => { if (alive) setPlaylists(x); });
    if (tab === "albums") void fetchSavedReleases().then((x) => { if (alive) setAlbums(x); });
    if (tab === "artists") void fetchFollowedArtists().then((x) => { if (alive) setArtists(x); });
    return () => { alive = false; };
  }, [tab]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPlaylistName(name)) return;
    const res = await createPlaylist(name);
    if (res.error || !res.playlist) { dialogs.notify(playlistMessage(res.error ?? ""), "error"); return; }
    setName("");
    setPlaylists((l) => [res.playlist as Playlist, ...(l ?? [])]);
  }

  return (
    <MusicPage>
      <MusicNav />
      <h1 className="flex items-center gap-2 text-3xl font-black"><Library className="h-7 w-7 text-[#F5B83D]" /> Ma musique</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/music/favorites" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold"><Heart className="h-4 w-4 text-[#F5B83D]" /> Titres aimés</Link>
        <Link href="/music/history" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold"><Clock className="h-4 w-4 text-[#F5B83D]" /> Historique</Link>
      </div>
      <div className="mt-6 flex gap-2 border-b border-white/10">
        {([["playlists", "Playlists"], ["albums", "Albums"], ["artists", "Artistes"]] as const).map(([v, l]) => (
          <button key={v} type="button" onClick={() => setTab(v)} aria-pressed={tab === v}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-semibold", tab === v ? "border-[#F5B83D] text-white" : "border-transparent text-white/60")}>{l}</button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "playlists" ? (
          <>
            <form onSubmit={create} className="mb-4 flex max-w-md gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Nouvelle playlist"
                className="h-10 min-w-0 flex-1 rounded-xl border border-white/20 bg-white/5 px-3 text-sm text-white placeholder:text-white/40" />
              <button type="submit" disabled={!isValidPlaylistName(name)}
                className="inline-flex items-center gap-1 rounded-xl bg-[#F5B83D] px-3 text-sm font-bold text-[#0D0B19] disabled:opacity-40"><Plus className="h-4 w-4" /> Créer</button>
            </form>
            {playlists === null ? <Spinner /> : playlists.length === 0 ? <p className="text-sm text-white/60">Aucune playlist pour l’instant.</p> : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {playlists.map((p) => (
                  <li key={p.id}>
                    <Link href={`/music/playlist/${p.id}`} className="block rounded-xl bg-white/5 p-3 hover:bg-white/10">
                      <span className="block truncate font-semibold">{p.name}</span>
                      <span className="text-xs text-white/60">{p.music_playlist_items?.[0]?.count ?? 0} titres · {p.is_public ? "publique" : "privée"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : tab === "albums" ? (albums === null ? <Spinner /> : <ReleaseGrid releases={albums} />)
          : artists === null ? <Spinner /> : artists.length === 0 ? <p className="text-sm text-white/60">Vous ne suivez aucun artiste.</p> : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {artists.map((a) => (
                <li key={a.id}>
                  <Link href={`/artist/${a.id}`} className="block text-center">
                    <Cover url={a.avatar_url} size={320} alt={a.name} className="mx-auto w-28" rounded="rounded-full" />
                    <span className="mt-2 block truncate text-sm font-semibold">{a.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </div>
    </MusicPage>
  );
}

export function FavoritesView() {
  const [tracks, setTracks] = useState<MusicTrack[] | null>(null);
  useEffect(() => { void fetchLikedTracks().then(setTracks); }, []);
  const queue = useMemo(() => toQueue(tracks ?? []), [tracks]);
  return (
    <MusicPage>
      <MusicNav />
      <h1 className="flex items-center gap-2 text-3xl font-black"><Heart className="h-7 w-7 fill-[#F5B83D] text-[#F5B83D]" /> Titres aimés</h1>
      <div className="mt-6">
        {tracks === null ? <Spinner /> : queue.length === 0 ? <p className="text-sm text-white/60">Aucun titre aimé pour l’instant.</p> : (
          <><PlayAllButton items={queue} /><div className="mt-4"><TrackList items={queue} showCover numbered={false} /></div></>
        )}
      </div>
    </MusicPage>
  );
}

export function HistoryView() {
  const dialogs = useDialogs();
  const [rows, setRows] = useState<Array<{ track: MusicTrack; last_played_at: string; play_count: number }> | null>(null);
  useEffect(() => { void fetchHistory().then(setRows); }, []);
  const queue = useMemo(() => toQueue((rows ?? []).map((r) => r.track)), [rows]);

  async function clear() {
    const ok = await dialogs.confirm({ title: "Effacer l’historique ?", message: "Sur le site et dans l’application.", confirmLabel: "Effacer", danger: true });
    if (!ok) return;
    if (await clearHistory()) setRows([]); else dialogs.notify("Action impossible pour l’instant.", "error");
  }

  return (
    <MusicPage>
      <MusicNav />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-3xl font-black"><Clock className="h-7 w-7 text-[#F5B83D]" /> Historique d’écoute</h1>
        {rows && rows.length > 0 ? (
          <button type="button" onClick={clear} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-sm text-white/80">
            <Trash2 className="h-4 w-4" /> Effacer
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-white/60">Les titres écoutés au moins 30 secondes, sur le site et dans l’application (90 derniers jours).</p>
      <div className="mt-6">
        {rows === null ? <Spinner /> : queue.length === 0 ? <p className="text-sm text-white/60">Rien pour l’instant.</p>
          : <TrackList items={queue} showCover numbered={false} />}
      </div>
    </MusicPage>
  );
}

export function PlaylistView({ id }: { id: string }) {
  const { user } = useAuth();
  const dialogs = useDialogs();
  const router = useRouter();
  const [data, setData] = useState<{ playlist: Playlist | null; tracks: MusicTrack[] } | null>(null);
  useEffect(() => { void fetchPlaylist(id).then(setData); }, [id, user]);
  const queue = useMemo(() => toQueue(data?.tracks ?? []), [data]);
  const mine = !!user && data?.playlist?.owner_id === user.id;

  async function rename() {
    if (!data?.playlist) return;
    const name = await dialogs.ask({ title: "Renommer la playlist", placeholder: data.playlist.name, confirmLabel: "Renommer", maxLength: 60 });
    if (name === null || !isValidPlaylistName(name)) return;
    const err = await updatePlaylist(id, { name: name.trim() });
    if (err) { dialogs.notify(playlistMessage(err), "error"); return; }
    setData((d) => d && d.playlist ? { ...d, playlist: { ...d.playlist, name: name.trim() } } : d);
  }

  async function togglePublic() {
    if (!data?.playlist) return;
    const err = await updatePlaylist(id, { is_public: !data.playlist.is_public });
    if (err) { dialogs.notify(playlistMessage(err), "error"); return; }
    setData((d) => d && d.playlist ? { ...d, playlist: { ...d.playlist, is_public: !d.playlist.is_public } } : d);
  }

  async function remove() {
    const ok = await dialogs.confirm({ title: "Supprimer cette playlist ?", message: "Sur le site et dans l’application.", confirmLabel: "Supprimer", danger: true });
    if (!ok) return;
    if (await deletePlaylist(id)) router.push("/music/library"); else dialogs.notify("Suppression impossible.", "error");
  }

  async function removeTrack(trackId: string) {
    if (await removeFromPlaylist(id, trackId)) {
      setData((d) => d ? { ...d, tracks: d.tracks.filter((t) => t.id !== trackId) } : d);
    }
  }

  return (
    <MusicPage>
      <MusicNav />
      {data === null ? <Spinner /> : !data.playlist ? (
        <p className="text-white/70">Cette playlist est privée ou n’existe plus.</p>
      ) : (
        <>
          <p className="text-xs font-bold uppercase tracking-widest text-[#F5B83D]">Playlist {data.playlist.is_public ? "publique" : "privée"}</p>
          <h1 className="mt-1 text-3xl font-black">{data.playlist.name}</h1>
          {data.playlist.description ? <p className="mt-2 text-sm text-white/70">{data.playlist.description}</p> : null}
          <p className="mt-1 text-sm text-white/60">{releaseMeta(data.tracks)}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <PlayAllButton items={queue} />
            {mine ? (
              <>
                <button type="button" onClick={rename} className="rounded-full border border-white/30 px-4 py-2 text-sm">Renommer</button>
                <button type="button" onClick={togglePublic} className="rounded-full border border-white/30 px-4 py-2 text-sm">
                  {data.playlist.is_public ? "Rendre privée" : "Rendre publique"}
                </button>
                <button type="button" onClick={remove} className="rounded-full border border-red-300/40 px-4 py-2 text-sm text-red-300">Supprimer</button>
              </>
            ) : null}
          </div>
          <div className="mt-6">
            {queue.length === 0 ? <p className="text-sm text-white/60">Cette playlist est vide.</p> : (
              <TrackList items={queue} showCover numbered={false} extra={mine ? (item) => (
                <button type="button" onClick={() => removeTrack(item.track.id)} aria-label="Retirer de la playlist" className="rounded-full p-1.5 text-white/50 hover:text-white">
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : undefined} />
            )}
          </div>
        </>
      )}
    </MusicPage>
  );
}

/** Page d'une sortie chargée côté navigateur (titre ouvert par la recherche). */
export function AlbumClientLoader({ id, highlight }: { id: string; highlight?: string | null }) {
  const [data, setData] = useState<{ release: MusicRelease | null; tracks: MusicTrack[] } | null>(null);
  useEffect(() => { void fetchRelease(id).then(setData); }, [id]);
  if (data === null) return <MusicPage><Spinner /></MusicPage>;
  if (!data.release) return <MusicPage><p className="text-white/70">Cette sortie n’est pas disponible.</p></MusicPage>;
  return <AlbumView release={data.release} tracks={data.tracks} highlight={highlight} />;
}
