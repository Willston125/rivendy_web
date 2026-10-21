import type { Metadata } from "next";
import { MusicHomeView } from "@/features/music/music-views";

export const metadata: Metadata = {
  title: "Rivendy Musique — Le son des Comores et d’ailleurs",
  description: "Singles, EP et albums des artistes Rivendy, le Rivendy Hit de la semaine et vos playlists, sur le site et dans l’application.",
  alternates: { canonical: "/music" },
};

export default function MusicHomePage() {
  return <MusicHomeView />;
}
