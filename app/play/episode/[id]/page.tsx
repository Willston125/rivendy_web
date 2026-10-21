import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EpisodeView } from "@/features/play/play-views";
import { wideImage } from "@/features/play/play-logic";
import { getEpisode } from "@/features/play/server/play-server";
import { JsonLd, episodeDescription, episodeJsonLd } from "@/features/play/server/play-seo";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getEpisode(id);
  if (!data) return { title: "Épisode indisponible — Rivendy Play", robots: { index: false } };
  const { episode: e, series } = data;
  const title = `${series.title} — S${e.season} É${e.episode_number} : ${e.title} — Rivendy Play`;
  const description = episodeDescription(e, series);
  const image = e.thumbnail_url || wideImage(series);
  return {
    title,
    description,
    alternates: { canonical: `/play/episode/${e.id}` },
    openGraph: { title, description, type: "video.episode", images: image ? [{ url: image }] : [] },
  };
}

export default async function PlayEpisodePage({ params }: Props) {
  const { id } = await params;
  const data = await getEpisode(id);
  if (!data) notFound();
  return (
    <>
      <JsonLd data={episodeJsonLd(data.episode, data.series)} />
      <EpisodeView episode={data.episode} series={data.series} />
    </>
  );
}
