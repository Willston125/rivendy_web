import { cache } from "react";
import type { Metadata } from "next";
import { createAnonServerClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/features/play/play-link-page";
import { MusiqueLinkPage, formatMusiqueDuration, type MusiqueLinkContent } from "@/features/musique/musique-link-page";

/**
 * Rivendy Musique — lien partagé d'un podcast (lot 4, 2026-10-16). Avec l'app,
 * Android ne passe pas par ici (App Link) ; sans elle : image, présentation,
 * derniers épisodes, et le chemin vers l'application.
 */

type PodcastRow = {
  id: string;
  title: string;
  author_name: string | null;
  description: string | null;
  cover_url: string | null;
  category: string | null;
};

type EpisodeRow = { title: string; number: number | null; duration_seconds: number | null };

// La RLS ne rend que les podcasts et épisodes publiés ; colonnes listées.
const getPodcast = cache(async (id: string) => {
  if (!UUID_RE.test(id)) return null;
  const supabase = createAnonServerClient();
  const { data } = await supabase
    .from("music_podcasts")
    .select("id, title, author_name, description, cover_url, category")
    .eq("id", id)
    .maybeSingle();
  const podcast = (data as PodcastRow | null) ?? null;
  if (!podcast) return null;
  const { data: episodes } = await supabase
    .from("music_episodes")
    .select("title, number, duration_seconds")
    .eq("podcast_id", id)
    .order("published_at", { ascending: false })
    .limit(12);
  return { podcast, episodes: (episodes as EpisodeRow[] | null) ?? [] };
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.rivendy.com";

function toContent(p: PodcastRow, episodes: EpisodeRow[]): MusiqueLinkContent {
  return {
    kicker: "Podcast · Rivendy Musique",
    title: p.title,
    subtitle: [p.author_name?.trim() || "Rivendy", p.category].filter(Boolean).join(" · "),
    description: p.description,
    image: p.cover_url,
    items: episodes.map((e) => ({
      title: e.number ? `n° ${e.number} · ${e.title}` : e.title,
      duration: formatMusiqueDuration(e.duration_seconds),
    })),
  };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const found = await getPodcast(id);
  if (!found) return { title: "Podcast indisponible — Rivendy Musique", robots: { index: false } };
  const { podcast } = found;
  const title = `${podcast.title} — podcast | Rivendy Musique`;
  const description = podcast.description?.slice(0, 160) || `Écoutez le podcast « ${podcast.title} » dans l’application Rivendy.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/musique/podcast/${podcast.id}` },
    openGraph: { title, description, images: podcast.cover_url ? [{ url: podcast.cover_url }] : [], type: "website" },
  };
}

export default async function MusiquePodcastLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await getPodcast(id);
  return (
    <MusiqueLinkPage
      path={found ? `/musique/podcast/${found.podcast.id}` : "/"}
      content={found ? toContent(found.podcast, found.episodes) : null}
    />
  );
}
