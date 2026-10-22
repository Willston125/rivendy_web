import type { Metadata } from "next";
import { Suspense } from "react";
import { ExploreView } from "@/features/music/music-views";

export const metadata: Metadata = {
  title: "Explorer — Rivendy Musique",
  description: "Cherchez un titre, un artiste ou un album, et parcourez la musique de Rivendy par genre.",
  alternates: { canonical: "/music/explore" },
};

export default function MusicExplorePage() {
  // La recherche et le genre vivent dans l'adresse (?q=, ?genre=).
  return (
    <Suspense fallback={null}>
      <ExploreView />
    </Suspense>
  );
}
