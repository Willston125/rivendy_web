import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ClipWatchView } from "@/features/play/clips/clip-watch";
import { titlePath, wideImage } from "@/features/play/play-logic";
import { getTitle } from "@/features/play/server/play-server";
import { JsonLd, titleDescription, titleJsonLd } from "@/features/play/server/play-seo";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await getTitle(id);
  if (!t) return { title: "Clip indisponible — Rivendy Clips", robots: { index: false } };
  const description = titleDescription(t);
  const image = wideImage(t);
  const name = t.artist ? `${t.title} — ${t.artist}` : t.title;
  return {
    title: `${name} — Rivendy Clips`,
    description,
    alternates: { canonical: titlePath(t) },
    openGraph: { title: `${name} — Rivendy Clips`, description, type: "video.other", images: image ? [{ url: image }] : [] },
  };
}

/**
 * Un clip (refonte Clips du 2026-10-26) : cette adresse EST l'écran de
 * visionnage — une carte, une suggestion ou un lien partagé lance la lecture
 * sans fiche intermédiaire. Les données de partage (titre, image, JSON-LD)
 * restent rendues par le serveur.
 */
export default async function PlayClipPage({ params }: Props) {
  const { id } = await params;
  const t = await getTitle(id);
  if (!t) notFound();
  if (t.kind !== "clip") permanentRedirect(titlePath(t));
  return (
    <>
      <JsonLd data={titleJsonLd(t)} />
      <ClipWatchView key={t.id} initial={t} />
    </>
  );
}
