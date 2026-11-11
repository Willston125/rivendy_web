import type { Metadata } from "next";
import { StudioReleasesView } from "@/features/music/studio/studio-releases";

/** Studio de l'artiste (publier sur le site, lot 2, 2026-11-11) : espace privé, jamais indexé. */
export const metadata: Metadata = {
  title: "Mes sorties — Rivendy Musique",
  robots: { index: false, follow: false },
};

export default function StudioPage() {
  return <StudioReleasesView />;
}
