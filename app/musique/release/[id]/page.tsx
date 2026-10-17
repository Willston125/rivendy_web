import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAnonServerClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/features/play/play-link-page";
import { MusiqueLinkPage, formatMusiqueDuration, type MusiqueLinkContent } from "@/features/musique/musique-link-page";

/**
 * Rivendy Musique — lien partagé d'une sortie (single, EP, album ; lot 4,
 * 2026-10-16). Avec l'app, Android ne passe pas par ici (App Link) ; sans
 * elle : pochette, artiste, titres, et le chemin vers l'application.
 */

type ReleaseRow = {
  id: string;
  kind: string;
  title: string;
  artist_name: string | null;
  description: string | null;
  cover_url: string | null;
  release_date: string | null;
  published_at: string | null;
  play_artists: { name: string } | null;
};

type TrackRow = { title: string; position: number; duration_seconds: number | null };

// La RLS ne rend que les sorties publiées (artiste validé) ; colonnes listées :
// l'emplacement des fichiers audio n'est jamais lisible.
const getRelease = cache(async (id: string) => {
  if (!UUID_RE.test(id)) return null;
  const supabase = createAnonServerClient();
  const { data } = await supabase
    .from("music_releases")
    .select("id, kind, title, artist_name, description, cover_url, release_date, published_at, play_artists(name)")
    .eq("id", id)
    .maybeSingle();
  const release = (data as unknown as ReleaseRow | null) ?? null;
  if (!release) return null;
  const { data: tracks } = await supabase
    .from("music_tracks")
    .select("title, position, duration_seconds")
    .eq("release_id", id)
    .order("position");
  return { release, tracks: (tracks as TrackRow[] | null) ?? [] };
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.rivendy.com";

const KIND_LABEL: Record<string, string> = { single: "Single", ep: "EP", album: "Album" };

function artistOf(r: ReleaseRow): string {
  return r.play_artists?.name?.trim() || r.artist_name?.trim() || "Rivendy";
}

function toContent(r: ReleaseRow, tracks: TrackRow[]): MusiqueLinkContent {
  const year = (r.release_date ?? r.published_at ?? "").slice(0, 4);
  return {
    kicker: "Rivendy Musique",
    title: r.title,
    subtitle: [artistOf(r), KIND_LABEL[r.kind] ?? "Sortie", year || null].filter(Boolean).join(" · "),
    description: r.description,
    image: r.cover_url,
    items: tracks.map((t) => ({ title: t.title, duration: formatMusiqueDuration(t.duration_seconds) })),
  };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const found = await getRelease(id);
  if (!found) return { title: "Sortie indisponible — Rivendy Musique", robots: { index: false } };
  const { release } = found;
  const title = `${release.title} — ${artistOf(release)} | Rivendy Musique`;
  const description = release.description?.slice(0, 160) || `Écoutez « ${release.title} » de ${artistOf(release)} dans l’application Rivendy.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/musique/release/${release.id}` },
    openGraph: {
      title,
      description,
      images: release.cover_url ? [{ url: release.cover_url }] : [],
      type: "music.album",
    },
  };
}

export default async function MusiqueReleaseLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await getRelease(id);
  // Audit 17 (WEB-21) : introuvable → 404.
  if (!found) notFound();
  // Chemin bâti sur l'identifiant VALIDÉ (lu en base), jamais sur l'URL brute :
  // il entre dans une adresse intent:// (« J'ai déjà l'application »).
  return (
    <MusiqueLinkPage
      path={found ? `/musique/release/${found.release.id}` : "/"}
      content={found ? toContent(found.release, found.tracks) : null}
    />
  );
}
