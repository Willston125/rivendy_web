import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlbumView } from "@/features/music/music-views";
import { artistName, releaseKindLabel } from "@/features/music/music-logic";
import { getRelease } from "@/features/music/server/music-server";
import { clip } from "@/lib/seo";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getRelease(id);
  if (!data) return { title: "Sortie introuvable — Rivendy", robots: { index: false } };
  const { release } = data;
  const title = `${release.title} — ${artistName(release)} — Rivendy Musique`;
  const description = clip(release.description || `${releaseKindLabel(release.kind)} de ${artistName(release)} sur Rivendy Musique.`, 155);
  return {
    title,
    description,
    alternates: { canonical: `/music/album/${release.id}` },
    openGraph: { title, description, type: "music.album", images: release.cover_url ? [{ url: release.cover_url }] : undefined },
  };
}

export default async function AlbumPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { t } = await searchParams;
  const data = await getRelease(id);
  if (!data) notFound();
  return <AlbumView release={data.release} tracks={data.tracks} highlight={t ?? null} />;
}
