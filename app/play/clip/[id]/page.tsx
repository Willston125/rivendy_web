import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { TitleView } from "@/features/play/play-views";
import { titlePath, wideImage } from "@/features/play/play-logic";
import { getTitle } from "@/features/play/server/play-server";
import { JsonLd, titleDescription, titleJsonLd } from "@/features/play/server/play-seo";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await getTitle(id);
  if (!t) return { title: "Vidéo indisponible — Rivendy Play", robots: { index: false } };
  const description = titleDescription(t);
  const image = wideImage(t);
  const name = t.artist ? `${t.title} — ${t.artist}` : t.title;
  return {
    title: `${name} — Clip — Rivendy Play`,
    description,
    alternates: { canonical: titlePath(t) },
    openGraph: { title: `${name} — Rivendy Play`, description, type: "video.other", images: image ? [{ url: image }] : [] },
  };
}

export default async function PlayClipPage({ params }: Props) {
  const { id } = await params;
  const t = await getTitle(id);
  if (!t) notFound();
  if (t.kind !== "clip") permanentRedirect(titlePath(t));
  return (
    <>
      <JsonLd data={titleJsonLd(t)} />
      <TitleView title={t} />
    </>
  );
}
