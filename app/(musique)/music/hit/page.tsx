import type { Metadata } from "next";
import { HitView } from "@/features/music/music-views";

export const metadata: Metadata = {
  title: "Rivendy Hit — Le classement de la semaine — Rivendy Musique",
  description: "Les titres les plus écoutés de la semaine sur Rivendy Musique.",
  alternates: { canonical: "/music/hit" },
};

export default function HitPage() {
  return <HitView />;
}
