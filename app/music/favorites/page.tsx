import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/require-auth";
import { FavoritesView } from "@/features/music/music-views";

export const metadata: Metadata = {
  title: "Titres aimés — Rivendy Musique",
  robots: { index: false, follow: false },
};

export default function MusicFavoritesPage() {
  return (
    <RequireAuth>
      <FavoritesView />
    </RequireAuth>
  );
}
