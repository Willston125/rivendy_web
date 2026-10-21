import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { SeriesView } from "@/features/play/play-views";
import { cover, titlePath } from "@/features/play/play-logic";
import { getEpisodes, getTitle } from "@/features/play/server/play-server";
import { JsonLd, titleDescription, titleJsonLd } from "@/features/play/server/play-seo";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await getTitle(id);
  if (!t) return { title: "Vidéo indisponible — Rivendy Play", robots: { index: false } };
  const description = titleDescription(t);
  const image = cover(t);
  return {
    title: `${t.title} — Série — Rivendy Play`,
    description,
    alternates: { canonical: titlePath(t) },
    openGraph: { title: `${t.title} — Rivendy Play`, description, type: "video.tv_show", images: image ? [{ url: image }] : [] },
  };
}

export default async function PlaySeriesTitlePage({ params }: Props) {
  const { id } = await params;
  const t = await getTitle(id);
  if (!t) notFound();
  if (t.kind !== "serie") permanentRedirect(titlePath(t));
  const episodes = await getEpisodes(t.id);
  return (
    <>
      <JsonLd data={titleJsonLd(t)} />
      <SeriesView title={t} episodes={episodes} />
    </>
  );
}
