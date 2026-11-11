import type { Metadata } from "next";
import { RadioPreviewPage } from "@/features/music/radio/radio-views";

// Aperçu privé d'une station : jamais indexé, jamais listé.
export const metadata: Metadata = {
  title: "Aperçu privé | Rivendy Musique",
  robots: { index: false, follow: false, nocache: true },
};

export default async function RadioPreviewRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <RadioPreviewPage token={token} />;
}
