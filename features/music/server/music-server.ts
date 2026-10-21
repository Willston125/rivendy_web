import { cache } from "react";
import { createAnonServerClient } from "@/lib/supabase/server";
import { ARTIST_COLUMNS, RELEASE_COLUMNS, TRACK_COLUMNS, type MusicRelease, type MusicTrack } from "../music-logic";
import type { MusicArtist } from "../music-api";

/**
 * Lectures du SERVEUR pour les pages publiques de Rivendy Music (référencement,
 * aperçus de partage). Client anonyme : la RLS ne rend que ce qui est publié ;
 * le filtre « publié » est quand même écrit, comme partout sur le site.
 */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getRelease = cache(async (id: string): Promise<{ release: MusicRelease; tracks: MusicTrack[] } | null> => {
  if (!UUID_RE.test(id)) return null;
  const db = createAnonServerClient();
  const [{ data: release }, { data: tracks }] = await Promise.all([
    db.from("music_releases").select(`${RELEASE_COLUMNS}, music_release_countries(country_id)`)
      .eq("id", id).eq("status", "published").maybeSingle(),
    db.from("music_tracks").select(TRACK_COLUMNS).eq("release_id", id).order("position"),
  ]);
  if (!release) return null;
  return { release: release as unknown as MusicRelease, tracks: (tracks ?? []) as unknown as MusicTrack[] };
});

export const getTrackRelease = cache(async (id: string): Promise<string | null> => {
  if (!UUID_RE.test(id)) return null;
  const db = createAnonServerClient();
  const { data } = await db.from("music_tracks").select("release_id").eq("id", id).maybeSingle();
  return (data as { release_id?: string } | null)?.release_id ?? null;
});

export const getArtist = cache(async (id: string): Promise<MusicArtist | null> => {
  if (!UUID_RE.test(id)) return null;
  const db = createAnonServerClient();
  const { data } = await db.from("play_artists").select(ARTIST_COLUMNS).eq("id", id).maybeSingle();
  return (data as MusicArtist | null) ?? null;
});

export const getPublicPlaylist = cache(async (id: string): Promise<{ name: string; description: string | null } | null> => {
  if (!UUID_RE.test(id)) return null;
  const db = createAnonServerClient();
  const { data } = await db.from("music_playlists").select("name, description").eq("id", id).maybeSingle();
  return (data as { name: string; description: string | null } | null) ?? null;
});
