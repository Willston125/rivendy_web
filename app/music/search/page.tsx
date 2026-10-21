import type { Metadata } from "next";
import { SearchView } from "@/features/music/music-views";

export const metadata: Metadata = {
  title: "Recherche — Rivendy Musique",
  robots: { index: false, follow: true },
};

export default function MusicSearchPage() {
  return <SearchView />;
}
