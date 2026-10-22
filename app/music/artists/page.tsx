import type { Metadata } from "next";
import { ArtistsView } from "@/features/music/music-views";

export const metadata: Metadata = {
  title: "Artistes — Rivendy Musique",
  description: "Les artistes à écouter sur Rivendy Musique : leurs titres populaires et leurs sorties.",
  alternates: { canonical: "/music/artists" },
};

export default function MusicArtistsPage() {
  return <ArtistsView />;
}
