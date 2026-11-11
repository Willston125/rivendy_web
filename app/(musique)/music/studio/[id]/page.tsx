import type { Metadata } from "next";
import { ReleaseEditor } from "@/features/music/studio/release-editor";

/**
 * Une sortie du studio, ou « nouvelle » (publier sur le site, lot 2,
 * 2026-11-11) : espace privé de l'artiste, jamais indexé.
 */
export const metadata: Metadata = {
  title: "Studio — Rivendy Musique",
  robots: { index: false, follow: false },
};

export default async function StudioReleasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReleaseEditor releaseId={id} />;
}
