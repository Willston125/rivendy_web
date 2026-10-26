import type { Metadata } from "next";
import { ClipsArtistSpaceView } from "@/features/play/clips/clips-artist-space";

export const metadata: Metadata = {
  title: "Espace artiste — Rivendy Clips",
  description: "Publiez vos clips gratuitement sur Rivendy Play : profil d’artiste vérifié, J’aime, commentaires et abonnés.",
  alternates: { canonical: "/play/clips/artiste" },
};

export default function ClipsArtistSpacePage() {
  return <ClipsArtistSpaceView />;
}
