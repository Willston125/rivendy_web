import { cache } from "react";
import { createAnonServerClient } from "@/lib/supabase/server";
import { EPISODE_COLUMNS, TITLE_COLUMNS, sortEpisodes, type PlayEpisode, type PlayTitle } from "../play-logic";

/**
 * Lectures du SERVEUR pour les pages publiques de Rivendy Play (référencement,
 * aperçus de partage). Client anonyme : la RLS ne rend que ce qui est publié ;
 * le filtre « publié » est quand même écrit. Colonnes listées : video_uid
 * reste fermé (aucune adresse de film dans le HTML rendu, §14.4).
 */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getTitle = cache(async (id: string): Promise<PlayTitle | null> => {
  if (!UUID_RE.test(id)) return null;
  const { data } = await createAnonServerClient().from("play_titles")
    .select(`${TITLE_COLUMNS}, play_title_countries(country_id)`)
    .eq("id", id).eq("status", "published").maybeSingle();
  return (data as unknown as PlayTitle | null) ?? null;
});

export const getEpisodes = cache(async (titleId: string): Promise<PlayEpisode[]> => {
  if (!UUID_RE.test(titleId)) return [];
  const { data } = await createAnonServerClient().from("play_episodes").select(EPISODE_COLUMNS)
    .eq("title_id", titleId).eq("status", "published");
  return sortEpisodes(((data ?? []) as unknown as PlayEpisode[]).filter((e) => e.video_status === "ready"));
});

export const getEpisode = cache(async (id: string): Promise<{ episode: PlayEpisode; series: PlayTitle } | null> => {
  if (!UUID_RE.test(id)) return null;
  const { data } = await createAnonServerClient().from("play_episodes").select(EPISODE_COLUMNS)
    .eq("id", id).eq("status", "published").maybeSingle();
  const episode = data as unknown as PlayEpisode | null;
  if (!episode) return null;
  const series = await getTitle(episode.title_id);
  return series && series.kind === "serie" ? { episode, series } : null;
});

/** Identifiants pour le plan du site (films, séries, clips publiés). */
export async function listPublishedTitles(limit = 2000): Promise<Array<{ id: string; kind: string; published_at: string | null }>> {
  const { data } = await createAnonServerClient().from("play_titles").select("id, kind, published_at")
    .eq("status", "published").in("kind", ["film", "serie", "clip"]).order("published_at", { ascending: false }).limit(limit);
  return (data ?? []) as Array<{ id: string; kind: string; published_at: string | null }>;
}
