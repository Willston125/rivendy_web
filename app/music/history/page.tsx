import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/require-auth";
import { HistoryView } from "@/features/music/music-views";

export const metadata: Metadata = {
  title: "Historique d’écoute — Rivendy Musique",
  robots: { index: false, follow: false },
};

export default function MusicHistoryPage() {
  return (
    <RequireAuth>
      <HistoryView />
    </RequireAuth>
  );
}
