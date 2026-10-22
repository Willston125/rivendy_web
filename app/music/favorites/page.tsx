import type { Metadata } from "next";
import { FavoritesView } from "@/features/music/music-views";

export const metadata: Metadata = {
  title: "Titres likés — Rivendy Musique",
  robots: { index: false, follow: false },
};

export default function MusicFavoritesPage() {
  // Sans compte, la page invite à se connecter, dans le thème de la Musique.
  return <FavoritesView />;
}
