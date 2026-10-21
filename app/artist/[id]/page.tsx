import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArtistView } from "@/features/music/music-views";
import { getArtist } from "@/features/music/server/music-server";
import { clip } from "@/lib/seo";

type Props = { params: Promise<{ id: string }> };

/** Page UNIQUE d'un artiste pour Play et Music (RIVENDY_OMNICHANNEL_ARCHITECTURE.md §13). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const a = await getArtist(id);
  if (!a) return { title: "Artiste introuvable — Rivendy", robots: { index: false } };
  return {
    title: `${a.name} — Rivendy`,
    description: clip(a.bio || `${a.name} sur Rivendy Musique et Rivendy Play.`, 155),
    alternates: { canonical: `/artist/${a.id}` },
    openGraph: { title: a.name, images: a.avatar_url ? [{ url: a.avatar_url }] : undefined },
  };
}

export default async function ArtistPage({ params }: Props) {
  const { id } = await params;
  const a = await getArtist(id);
  if (!a) notFound();
  return <ArtistView artist={a} />;
}
