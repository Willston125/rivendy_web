import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/require-auth";
import { LibraryView } from "@/features/music/music-views";

export const metadata: Metadata = {
  title: "Ma musique — Rivendy Musique",
  robots: { index: false, follow: false },
};

export default function MusicLibraryPage() {
  return (
    <RequireAuth>
      <LibraryView />
    </RequireAuth>
  );
}
