import type { Metadata } from "next";
import { LibraryView } from "@/features/music/music-views";

export const metadata: Metadata = {
  title: "Ma musique — Rivendy Musique",
  robots: { index: false, follow: false },
};

export default function MusicLibraryPage() {
  // Sans compte, la bibliothèque invite à se connecter, dans le thème de la Musique.
  return <LibraryView />;
}
