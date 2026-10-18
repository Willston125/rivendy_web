import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAnonServerClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/features/play/play-link-page";
import { MusiqueLinkPage, type MusiqueLinkContent } from "@/features/musique/musique-link-page";

/**
 * Rivendy Musique — lien partagé d'une story d'artiste (lot M6, 2026-10-18 —
 * spec 2026-10-17 §7). Avec l'app, Android ne passe pas par ici (App Link
 * `/musique/story/`) ; sans elle : l'image, l'artiste, le texte, et le chemin
 * vers l'application. Une story expirée, retirée ou d'un artiste qui n'est
 * plus validé → 404 « Cette story n'est plus disponible ».
 */

type StoryJson = {
  id: string;
  kind: "photo" | "video";
  photo_path: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  pinned: boolean;
  created_at: string;
  artist_name: string | null;
  artist_avatar_url: string | null;
  track: { title: string; artist: string | null } | null;
};

// music_story_get : la story SEULEMENT si elle est visible (publiée, dans ses
// 24 h ou à la une, vidéo prête, artiste validé) — sinon null.
const getStory = cache(async (id: string) => {
  if (!UUID_RE.test(id)) return null;
  const supabase = createAnonServerClient();
  const { data } = await supabase.rpc("music_story_get", { p_id: id });
  const story = (data as StoryJson | null) ?? null;
  return story && story.id === id ? story : null;
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.rivendy.com";
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");

function imageOf(s: StoryJson): string | null {
  if (s.kind === "video") return s.thumbnail_url;
  if (!s.photo_path) return null;
  const path = s.photo_path.split("/").map(encodeURIComponent).join("/");
  return `${SUPABASE_URL}/storage/v1/object/public/music-stories/${path}`;
}

function artistOf(s: StoryJson): string {
  return s.artist_name?.trim() || "Un artiste";
}

function toContent(s: StoryJson): MusiqueLinkContent {
  const track = s.track?.title ? `♪ ${s.track.title}${s.track.artist ? ` · ${s.track.artist}` : ""}` : null;
  return {
    kicker: s.pinned ? "Story à la une · Rivendy Musique" : "Story · Rivendy Musique",
    title: artistOf(s),
    subtitle: [s.kind === "video" ? "Vidéo" : "Photo", track].filter(Boolean).join(" · "),
    description: s.caption?.trim() || null,
    image: imageOf(s),
    note: s.pinned
      ? "Regardez ses stories, aimez-les, commentez et suivez cet artiste dans l’application Rivendy."
      : "Une story reste en ligne 24 heures : regardez-la, aimez-la et commentez-la dans l’application Rivendy.",
  };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const story = await getStory(id);
  if (!story) return { title: "Story indisponible — Rivendy Musique", robots: { index: false } };
  const title = `Story de ${artistOf(story)} | Rivendy Musique`;
  const description =
    story.caption?.trim().slice(0, 160) || `Découvrez la story de ${artistOf(story)} dans l’application Rivendy.`;
  const image = imageOf(story);
  return {
    title,
    description,
    // Une story est éphémère : partageable, jamais indexée.
    robots: { index: false, follow: true },
    alternates: { canonical: `${SITE_URL}/musique/story/${story.id}` },
    openGraph: { title, description, images: image ? [{ url: image }] : [], type: "website" },
  };
}

export default async function MusiqueStoryLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await getStory(id);
  if (!story) notFound();
  // Chemin bâti sur l'identifiant VALIDÉ (lu en base), jamais sur l'URL brute :
  // il entre dans une adresse intent:// (« J'ai déjà l'application »).
  return <MusiqueLinkPage path={`/musique/story/${story.id}`} content={toContent(story)} />;
}
