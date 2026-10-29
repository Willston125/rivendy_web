import type { Metadata } from "next";
import { MusicArtistSpaceView } from "@/features/music/music-artist-space";

export const metadata: Metadata = {
  title: "Espace artiste — Rivendy Musique",
  description: "Publiez vos singles, EP et albums sur Rivendy Musique : un compte artiste vérifié par Rivendy, la publication depuis l’application.",
  alternates: { canonical: "/music/artiste" },
};

export default function MusicArtistSpacePage() {
  return <MusicArtistSpaceView />;
}
