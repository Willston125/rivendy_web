import type { Metadata } from "next";
import { PlaylistView } from "@/features/music/music-views";
import { getPublicPlaylist } from "@/features/music/server/music-server";
import { clip } from "@/lib/seo";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await getPublicPlaylist(id);
  // Playlist privée (ou inexistante) : jamais indexée.
  if (!p) return { title: "Playlist — Rivendy Musique", robots: { index: false, follow: false } };
  return {
    title: `${p.name} — Playlist Rivendy Musique`,
    description: clip(p.description || "Une playlist Rivendy Musique.", 155),
    alternates: { canonical: `/music/playlist/${id}` },
  };
}

export default async function PlaylistPage({ params }: Props) {
  const { id } = await params;
  return <PlaylistView id={id} />;
}
