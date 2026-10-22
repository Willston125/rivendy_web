import type { Metadata } from "next";
import { HistoryView } from "@/features/music/music-views";

export const metadata: Metadata = {
  title: "Historique d’écoute — Rivendy Musique",
  robots: { index: false, follow: false },
};

export default function MusicHistoryPage() {
  // Sans compte, la page invite à se connecter, dans le thème de la Musique.
  return <HistoryView />;
}
