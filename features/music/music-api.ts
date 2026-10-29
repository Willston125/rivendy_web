import { supabase } from "@/lib/supabase/client";
import {
  ARTIST_COLUMNS, RELEASE_COLUMNS, TRACK_COLUMNS, availableIn,
  type MusicRelease, type MusicTrack,
} from "./music-logic";

/**
 * Rivendy Music — lectures et écritures depuis le navigateur (Omnicanal lot D,
 * 2026-10-21). Les MÊMES tables et fonctions que l'app 1.4.9 : ce que le
 * compte aime, enregistre ou range sur le site apparaît dans l'app, et
 * inversement. Le serveur fixe les règles (droits, marché, comptage).
 */

const RELEASE_WITH_TERRITORY = `${RELEASE_COLUMNS}, music_release_countries(country_id)`;
const TRACK_WITH_RELEASE = `${TRACK_COLUMNS}, music_releases(${RELEASE_WITH_TERRITORY})`;

export type MusicArtist = {
  id: string; user_id: string | null; name: string; genre?: string | null; country_id?: string | null;
  bio?: string | null; avatar_url?: string | null; banner_url?: string | null; island_id?: string | null;
};

export type HitRow = { rank: number; plays: number; previous_rank: number | null; week_start: string; music_tracks: MusicTrack | null };

export type SearchRow = {
  kind: "track" | "release" | "artist" | "podcast"; id: string; title: string;
  subtitle: string | null; cover_url: string | null; release_id: string | null;
};

export type Playlist = {
  id: string; owner_id: string; name: string; description: string | null; is_public: boolean;
  updated_at: string; music_playlist_items?: Array<{ count: number }>;
};

const PLAYLIST_COLUMNS = "id, owner_id, name, description, is_public, updated_at, music_playlist_items(count)";

const published = (r: MusicRelease | null | undefined): r is MusicRelease =>
  !!r && (r as MusicRelease & { status?: string }).status !== "draft";

/**
 * Lecture du catalogue : une panne (réseau, serveur) LÈVE une erreur, pour
 * que la page dise « impossible de charger » au lieu d'un catalogue vide.
 */
function must<T>(res: { data: T | null; error: { message: string } | null }): T | null {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export type MusicGenre = { id: string; name: string; position: number };

// ── Catalogue ──────────────────────────────────────────────────────────────

export async function fetchFeatured(market: string | null): Promise<MusicRelease[]> {
  const data = must(await supabase.from("music_releases").select(RELEASE_WITH_TERRITORY)
    .eq("status", "published").not("featured_rank", "is", null)
    .order("featured_rank", { ascending: true }).limit(30));
  return ((data ?? []) as unknown as MusicRelease[]).filter((r) => availableIn(r, market));
}

/** Sorties récentes, d'un genre si demandé (`genre` = id de music_genres). */
export async function fetchNewReleases(market: string | null, limit = 60, genre: string | null = null): Promise<MusicRelease[]> {
  let q = supabase.from("music_releases").select(RELEASE_WITH_TERRITORY).eq("status", "published");
  if (genre) q = q.eq("genre_id", genre);
  const data = must(await q.order("published_at", { ascending: false }).limit(limit));
  return ((data ?? []) as unknown as MusicRelease[]).filter((r) => availableIn(r, market));
}

/** Genres ouverts au dashboard, dans leur ordre. */
export async function fetchGenres(): Promise<MusicGenre[]> {
  const data = must(await supabase.from("music_genres").select("id, name, position")
    .eq("is_active", true).order("position"));
  return (data ?? []) as MusicGenre[];
}

/** Profils d'artistes, dans l'ordre des identifiants donnés. */
export async function fetchArtistsByIds(ids: string[]): Promise<MusicArtist[]> {
  if (ids.length === 0) return [];
  const data = must(await supabase.from("play_artists").select(ARTIST_COLUMNS).in("id", ids.slice(0, 200)));
  const byId = new Map(((data ?? []) as MusicArtist[]).map((a) => [a.id, a]));
  return ids.map((id) => byId.get(id)).filter((a): a is MusicArtist => !!a);
}

/**
 * Artistes qui ont de la musique publiée dans ce marché (les plus récents
 * d'abord) : seuls ceux-là ont une page à écouter.
 */
export async function fetchArtistsWithMusic(market: string | null): Promise<MusicArtist[]> {
  const data = must(await supabase.from("music_releases").select("artist_id, published_at, music_release_countries(country_id)")
    .eq("status", "published").not("artist_id", "is", null).order("published_at", { ascending: false }).limit(400));
  const rows = ((data ?? []) as unknown as Array<Pick<MusicRelease, "artist_id" | "music_release_countries">>)
    .filter((r) => availableIn(r, market));
  const seen = new Set<string>();
  for (const r of rows) if (r.artist_id) seen.add(r.artist_id);
  return fetchArtistsByIds([...seen]);
}

export async function fetchReleasesByArtist(artistId: string, market: string | null): Promise<MusicRelease[]> {
  const data = must(await supabase.from("music_releases").select(RELEASE_WITH_TERRITORY)
    .eq("status", "published").eq("artist_id", artistId).order("published_at", { ascending: false }).limit(120));
  return ((data ?? []) as unknown as MusicRelease[]).filter((r) => availableIn(r, market));
}

export async function fetchRelease(id: string): Promise<{ release: MusicRelease | null; tracks: MusicTrack[] }> {
  const [r1, r2] = await Promise.all([
    supabase.from("music_releases").select(`${RELEASE_WITH_TERRITORY}, status`).eq("id", id).eq("status", "published").maybeSingle(),
    supabase.from("music_tracks").select(TRACK_COLUMNS).eq("release_id", id).order("position"),
  ]);
  const release = must(r1);
  const tracks = must(r2);
  return { release: (release as unknown as MusicRelease) ?? null, tracks: (tracks ?? []) as unknown as MusicTrack[] };
}

/** Titres (avec leur sortie) dans l'ordre demandé, en gardant seulement les publiés. */
/**
 * Titres de plusieurs sorties, dans l'ordre des sorties puis des pistes
 * (« Lancer la sélection » de l'accueil) ; mêmes règles que le catalogue :
 * publiées, ouvertes dans le marché.
 */
export async function fetchTracksOfReleases(releaseIds: string[], market: string | null): Promise<MusicTrack[]> {
  if (releaseIds.length === 0) return [];
  const data = must(await supabase.from("music_tracks").select(TRACK_WITH_RELEASE)
    .in("release_id", releaseIds).order("position"));
  const order = new Map(releaseIds.map((id, i) => [id, i]));
  return ((data ?? []) as unknown as MusicTrack[])
    .filter((t) => published(t.music_releases) && availableIn(t.music_releases, market))
    .sort((a, b) => (order.get(a.release_id) ?? 0) - (order.get(b.release_id) ?? 0) || a.position - b.position);
}

export async function fetchTracksByIds(ids: string[]): Promise<MusicTrack[]> {
  if (ids.length === 0) return [];
  const data = must(await supabase.from("music_tracks").select(TRACK_WITH_RELEASE).in("id", ids));
  const byId = new Map(((data ?? []) as unknown as MusicTrack[]).map((t) => [t.id, t]));
  return ids.map((id) => byId.get(id)).filter((t): t is MusicTrack => !!t && !!t.music_releases);
}

/** Rivendy Hit : la dernière semaine d'un classement (général, marché, origine). */
export async function fetchHit(scope: "all" | "country" | "island", scopeId: string, market: string | null): Promise<HitRow[]> {
  const last = must(await supabase.from("music_hit_weekly").select("week_start")
    .eq("scope", scope).eq("scope_id", scopeId).order("week_start", { ascending: false }).limit(1));
  const week = (last ?? [])[0]?.week_start as string | undefined;
  if (!week) return [];
  const data = must(await supabase.from("music_hit_weekly")
    .select(`rank, plays, previous_rank, week_start, music_tracks(${TRACK_WITH_RELEASE})`)
    .eq("scope", scope).eq("scope_id", scopeId).eq("week_start", week).order("rank").limit(50));
  return ((data ?? []) as unknown as HitRow[]).filter((h) => {
    const r = h.music_tracks?.music_releases;
    return published(r) && availableIn(r, market);
  });
}

export async function fetchArtist(id: string): Promise<MusicArtist | null> {
  const { data } = await supabase.from("play_artists").select(ARTIST_COLUMNS).eq("id", id).maybeSingle();
  return (data as MusicArtist | null) ?? null;
}

/** Titres populaires d'un artiste (ordre du serveur, déjà filtré par marché). */
export async function fetchArtistTopTracks(artistId: string, market: string | null): Promise<MusicTrack[]> {
  const { data } = await supabase.rpc("music_artist_top_tracks", { p_artist: artistId, p_market: market, p_limit: 10 });
  const ids = ((data ?? []) as Array<{ track_id?: string; id?: string }>).map((r) => r.track_id ?? r.id).filter((x): x is string => !!x);
  return fetchTracksByIds(ids);
}

export async function searchMusic(query: string): Promise<SearchRow[]> {
  const data = must(await supabase.rpc("music_search", { p_query: query.trim(), p_limit: 20 }));
  return (data ?? []) as SearchRow[];
}

// ── Lecture : lien signé, comptage, écrans ─────────────────────────────────

export type StreamGrant = {
  url: string; expires_at: string; preview: boolean; preview_seconds: number | null; premium: boolean;
  duration_seconds: number | null; playback_session_id: string | null; heartbeat_seconds: number | null;
};
export type StreamResult = { ok: true; grant: StreamGrant } | { ok: false; error: string; status?: number };

export async function fetchStreamGrant(trackId: string, deviceId: string, takeOver = false): Promise<StreamResult> {
  const { data, error } = await supabase.functions.invoke("musique-stream-url", {
    body: { track_id: trackId, device_id: deviceId, ...(takeOver ? { take_over: true } : {}) },
  });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let code = "network";
    let status: number | undefined;
    if (ctx && typeof ctx.json === "function") {
      status = ctx.status;
      try { code = ((await ctx.json()) as { error?: string })?.error ?? code; } catch { /* corps illisible */ }
    }
    return { ok: false, error: code, status };
  }
  const g = data as StreamGrant | null;
  if (!g?.url || !g.url.startsWith("https://")) return { ok: false, error: "bad_response" };
  return { ok: true, grant: g };
}

/** Écoute qualifiée (30 s réelles) : le serveur décide, le site rapporte seulement. */
export async function countPlay(trackId: string, market: string | null, seconds: number): Promise<void> {
  await supabase.rpc("music_count_play", { p_track: trackId, p_country: market ?? "", p_seconds: Math.round(seconds) });
}

export async function listenProgress(trackId: string, seconds: number): Promise<void> {
  await supabase.rpc("music_listen_progress", { p_track: trackId, p_seconds: Math.round(seconds) });
}

export async function playbackPing(sessionId: string): Promise<string | null> {
  const { data } = await supabase.rpc("playback_ping", { p_session: sessionId });
  return ((data as { status?: string } | null)?.status) ?? null;
}

export async function playbackClose(sessionId: string): Promise<void> {
  await supabase.rpc("playback_close", { p_session: sessionId });
}

// ── Bibliothèque : les mêmes lignes que l'app ──────────────────────────────

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Nombre de titres aimés par le compte (pastille « Mes favoris »). */
export async function fetchLikeCount(): Promise<number> {
  const u = await uid();
  if (!u) return 0;
  const { count } = await supabase.from("music_likes").select("track_id", { count: "exact", head: true }).eq("user_id", u);
  return count ?? 0;
}

export async function likedTrackIds(trackIds: string[]): Promise<Set<string>> {
  const u = await uid();
  if (!u || trackIds.length === 0) return new Set();
  const { data } = await supabase.from("music_likes").select("track_id").eq("user_id", u).in("track_id", trackIds);
  return new Set(((data ?? []) as Array<{ track_id: string }>).map((r) => r.track_id));
}

export async function setLiked(trackId: string, liked: boolean): Promise<boolean> {
  const u = await uid();
  if (!u) return false;
  const { error } = liked
    ? await supabase.from("music_likes").upsert({ user_id: u, track_id: trackId }, { ignoreDuplicates: true })
    : await supabase.from("music_likes").delete().eq("user_id", u).eq("track_id", trackId);
  return !error;
}

export async function fetchLikedTracks(): Promise<MusicTrack[]> {
  const u = await uid();
  if (!u) return [];
  const data = must(await supabase.from("music_likes").select(`created_at, music_tracks(${TRACK_WITH_RELEASE})`)
    .eq("user_id", u).order("created_at", { ascending: false }).limit(500));
  return ((data ?? []) as unknown as Array<{ created_at: string; music_tracks: MusicTrack | null }>)
    .filter((r) => !!r.music_tracks && !!r.music_tracks.music_releases)
    .map((r) => ({ ...(r.music_tracks as MusicTrack), added_at: r.created_at }));
}

export async function isReleaseSaved(releaseId: string): Promise<boolean> {
  const u = await uid();
  if (!u) return false;
  const { data } = await supabase.from("music_saved_releases").select("release_id").eq("user_id", u).eq("release_id", releaseId).maybeSingle();
  return !!data;
}

export async function setReleaseSaved(releaseId: string, saved: boolean): Promise<boolean> {
  const u = await uid();
  if (!u) return false;
  const { error } = saved
    ? await supabase.from("music_saved_releases").upsert({ user_id: u, release_id: releaseId }, { ignoreDuplicates: true })
    : await supabase.from("music_saved_releases").delete().eq("user_id", u).eq("release_id", releaseId);
  return !error;
}

export async function fetchSavedReleases(): Promise<MusicRelease[]> {
  const u = await uid();
  if (!u) return [];
  const data = must(await supabase.from("music_saved_releases").select(`created_at, music_releases(${RELEASE_WITH_TERRITORY})`)
    .eq("user_id", u).order("created_at", { ascending: false }).limit(300));
  return ((data ?? []) as unknown as Array<{ music_releases: MusicRelease | null }>)
    .map((r) => r.music_releases).filter((r): r is MusicRelease => !!r);
}

export async function fetchMyPlaylists(): Promise<Playlist[]> {
  const u = await uid();
  if (!u) return [];
  const data = must(await supabase.from("music_playlists").select(PLAYLIST_COLUMNS)
    .eq("owner_id", u).order("updated_at", { ascending: false }).limit(200));
  return (data ?? []) as Playlist[];
}

export async function fetchPlaylist(id: string): Promise<{ playlist: Playlist | null; tracks: MusicTrack[] }> {
  const [r1, r2] = await Promise.all([
    supabase.from("music_playlists").select(PLAYLIST_COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("music_playlist_items").select(`position, added_at, music_tracks(${TRACK_WITH_RELEASE})`)
      .eq("playlist_id", id).order("position").limit(1000),
  ]);
  const playlist = must(r1);
  const items = must(r2);
  const tracks = ((items ?? []) as unknown as Array<{ added_at: string | null; music_tracks: MusicTrack | null }>)
    .filter((r) => !!r.music_tracks && !!r.music_tracks.music_releases)
    .map((r) => ({ ...(r.music_tracks as MusicTrack), added_at: r.added_at }));
  return { playlist: (playlist as Playlist | null) ?? null, tracks };
}

/** Erreurs du serveur (gardes en base) traduites en codes simples. */
function playlistError(message: string | undefined, code?: string): string {
  if (code === "23505") return "already_in_playlist";
  const m = message ?? "";
  if (m.includes("music_playlist_full")) return "playlist_full";
  if (m.includes("music_playlist_limit")) return "playlist_limit";
  if (m.includes("contact_forbidden")) return "contact_forbidden";
  if (m.includes("sanctioned")) return "sanctioned";
  if (m.includes("playlist_locked")) return "playlist_locked";
  return "unknown";
}

export async function createPlaylist(name: string): Promise<{ playlist?: Playlist; error?: string }> {
  const { data, error } = await supabase.from("music_playlists").insert({ name: name.trim() }).select(PLAYLIST_COLUMNS).single();
  if (error) return { error: playlistError(error.message, error.code) };
  return { playlist: data as Playlist };
}

export async function updatePlaylist(id: string, patch: { name?: string; is_public?: boolean; description?: string | null }): Promise<string | null> {
  const { error } = await supabase.from("music_playlists").update(patch).eq("id", id);
  return error ? playlistError(error.message, error.code) : null;
}

export async function deletePlaylist(id: string): Promise<boolean> {
  const { error } = await supabase.from("music_playlists").delete().eq("id", id);
  return !error;
}

export async function addToPlaylist(playlistId: string, trackId: string): Promise<string | null> {
  const { error } = await supabase.from("music_playlist_items").insert({ playlist_id: playlistId, track_id: trackId });
  return error ? playlistError(error.message, error.code) : null;
}

export async function removeFromPlaylist(playlistId: string, trackId: string): Promise<boolean> {
  const { error } = await supabase.from("music_playlist_items").delete().eq("playlist_id", playlistId).eq("track_id", trackId);
  return !error;
}

/** Historique d'écoute du compte (rempli par le serveur à chaque écoute comptée). */
export async function fetchHistory(limit = 200): Promise<Array<{ track: MusicTrack; last_played_at: string; play_count: number }>> {
  const u = await uid();
  if (!u) return [];
  const data = must(await supabase.from("music_play_history")
    .select(`last_played_at, play_count, music_tracks(${TRACK_WITH_RELEASE})`)
    .eq("user_id", u).order("last_played_at", { ascending: false }).limit(limit));
  return ((data ?? []) as unknown as Array<{ last_played_at: string; play_count: number; music_tracks: MusicTrack | null }>)
    .filter((r) => r.music_tracks && r.music_tracks.music_releases)
    .map((r) => ({ track: r.music_tracks as MusicTrack, last_played_at: r.last_played_at, play_count: r.play_count }));
}

export async function clearHistory(): Promise<boolean> {
  const u = await uid();
  if (!u) return false;
  const { error } = await supabase.from("music_play_history").delete().eq("user_id", u);
  return !error;
}

/** Artistes suivis (on suit une personne : play_follows sur le compte de l'artiste). */
export async function fetchFollowedArtists(): Promise<MusicArtist[]> {
  const u = await uid();
  if (!u) return [];
  const follows = must(await supabase.from("play_follows").select("followed_id").eq("follower_id", u).limit(1000));
  const ids = ((follows ?? []) as Array<{ followed_id: string }>).map((f) => f.followed_id);
  if (ids.length === 0) return [];
  const data = must(await supabase.from("play_artists").select(ARTIST_COLUMNS).in("user_id", ids).order("name"));
  return (data ?? []) as MusicArtist[];
}

export async function isFollowing(personId: string): Promise<boolean> {
  const u = await uid();
  if (!u) return false;
  const { data } = await supabase.from("play_follows").select("followed_id").eq("follower_id", u).eq("followed_id", personId).maybeSingle();
  return !!data;
}

export async function setFollowing(personId: string, on: boolean): Promise<string | null> {
  const { data, error } = await supabase.rpc("person_follow", { p_user: personId, p_on: on, p_from: "creator" });
  if (error) return "network";
  const res = data as { success?: boolean; error?: string } | null;
  return res?.success ? null : res?.error ?? "unknown";
}

// ── « Ma bibliothèque » (mise en page application, 2026-10-22) ─────────────

export type LibraryOverview = {
  likeCount: number;
  likedAt: string | null;
  playlists: Array<Playlist & { covers: string[] }>;
  albums: Array<{ release: MusicRelease; savedAt: string }>;
  artists: Array<{ artist: MusicArtist; followedAt: string }>;
  /** Dernière écoute connue par sortie et par artiste (music_play_history). */
  lastPlayedByRelease: Record<string, string>;
  lastPlayedByArtist: Record<string, string>;
};

/**
 * Toute la bibliothèque du compte en une passe : favoris (nombre et dernier
 * ajout), playlists (et leurs 4 premières pochettes), albums enregistrés,
 * artistes suivis, et les dates des dernières écoutes pour le tri
 * « Récents ». Les mêmes lignes que l'app ; rien d'inventé.
 */
export async function fetchLibraryOverview(): Promise<LibraryOverview | null> {
  const u = await uid();
  if (!u) return null;
  const [likes, lists, saved, follows, history] = await Promise.all([
    supabase.from("music_likes").select("created_at", { count: "exact" }).eq("user_id", u)
      .order("created_at", { ascending: false }).limit(1),
    supabase.from("music_playlists").select(PLAYLIST_COLUMNS).eq("owner_id", u)
      .order("updated_at", { ascending: false }).limit(200),
    supabase.from("music_saved_releases").select(`created_at, music_releases(${RELEASE_WITH_TERRITORY})`)
      .eq("user_id", u).order("created_at", { ascending: false }).limit(300),
    supabase.from("play_follows").select("followed_id, created_at").eq("follower_id", u).limit(1000),
    supabase.from("music_play_history").select("last_played_at, music_tracks(release_id, music_releases(artist_id))")
      .eq("user_id", u).order("last_played_at", { ascending: false }).limit(300),
  ]);
  if (likes.error) throw new Error(likes.error.message);
  const playlists = (must(lists) ?? []) as Playlist[];
  const savedRows = (must(saved) ?? []) as unknown as Array<{ created_at: string; music_releases: MusicRelease | null }>;
  const followRows = (must(follows) ?? []) as Array<{ followed_id: string; created_at: string }>;
  const historyRows = (must(history) ?? []) as unknown as Array<{
    last_played_at: string; music_tracks: { release_id: string; music_releases: { artist_id: string | null } | null } | null;
  }>;

  // Pochettes des playlists : les 4 premières différentes, dans l'ordre des titres.
  const covers: Record<string, string[]> = {};
  if (playlists.length > 0) {
    const items = must(await supabase.from("music_playlist_items")
      .select("playlist_id, position, music_tracks(music_releases(cover_url))")
      .in("playlist_id", playlists.map((p) => p.id)).order("position").limit(800));
    for (const row of (items ?? []) as unknown as Array<{ playlist_id: string; music_tracks: { music_releases: { cover_url: string | null } | null } | null }>) {
      const url = row.music_tracks?.music_releases?.cover_url;
      const list = (covers[row.playlist_id] ??= []);
      if (url && list.length < 4 && !list.includes(url)) list.push(url);
    }
  }

  // Artistes suivis : seulement ceux qui ont un profil d'artiste (on suit une personne).
  let artists: LibraryOverview["artists"] = [];
  if (followRows.length > 0) {
    const data = must(await supabase.from("play_artists").select(ARTIST_COLUMNS).in("user_id", followRows.map((f) => f.followed_id)));
    const at = new Map(followRows.map((f) => [f.followed_id, f.created_at]));
    artists = ((data ?? []) as MusicArtist[]).map((a) => ({ artist: a, followedAt: at.get(a.user_id ?? "") ?? "" }));
  }

  const lastPlayedByRelease: Record<string, string> = {};
  const lastPlayedByArtist: Record<string, string> = {};
  for (const h of historyRows) {
    const rel = h.music_tracks?.release_id;
    const art = h.music_tracks?.music_releases?.artist_id;
    if (rel && !lastPlayedByRelease[rel]) lastPlayedByRelease[rel] = h.last_played_at;
    if (art && !lastPlayedByArtist[art]) lastPlayedByArtist[art] = h.last_played_at;
  }

  return {
    likeCount: likes.count ?? 0,
    likedAt: ((likes.data ?? []) as Array<{ created_at: string }>)[0]?.created_at ?? null,
    playlists: playlists.map((p) => ({ ...p, covers: covers[p.id] ?? [] })),
    albums: savedRows.filter((r) => !!r.music_releases).map((r) => ({ release: r.music_releases as MusicRelease, savedAt: r.created_at })),
    artists,
    lastPlayedByRelease,
    lastPlayedByArtist,
  };
}

// ── Espace artiste (lot 2, 2026-10-29) ─────────────────────────────────────

export type MyMusicArtist = {
  id: string; name: string; status: string; avatar_url: string | null; review_reason: string | null;
  /** « Clips seulement » quand false (audit n° 18, U3) ; absent = Musique activée, comme l'app. */
  music_enabled: boolean | null;
};

/** Profil artiste du compte, quel que soit son statut (null : pas encore artiste). */
export async function fetchMyMusicArtist(userId: string): Promise<MyMusicArtist | null> {
  const data = must(await supabase.from("play_artists")
    .select("id, name, status, avatar_url, review_reason, music_enabled").eq("user_id", userId).maybeSingle());
  return (data as MyMusicArtist | null) ?? null;
}

export type MyRelease = {
  id: string; kind: string; title: string; cover_url: string | null; status: string | null;
  review_status: string | null; review_reason: string | null; release_date: string | null;
  published_at: string | null; created_at: string;
};

/**
 * Mes sorties ENVOYÉES par l'artiste, brouillons compris : la lecture de
 * l'app (`MusiqueStudioService.fetchMyReleases`) — la RLS ne rend que celles
 * du compte. Les sorties publiées par Rivendy pour lui n'y figurent pas.
 */
export async function fetchMyReleases(artistId: string): Promise<MyRelease[]> {
  const data = must(await supabase.from("music_releases")
    .select("id, kind, title, cover_url, status, review_status, review_reason, release_date, published_at, created_at")
    .eq("artist_id", artistId).not("submitted_by", "is", null)
    .order("created_at", { ascending: false }).limit(100));
  return (data ?? []) as MyRelease[];
}
