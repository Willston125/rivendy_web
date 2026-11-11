import type { Metadata } from "next";
import { ClipFormView } from "@/features/play/clips/clip-form";

/** Envoyer un clip (`nouveau`) ou modifier le texte d'un clip (lot 3, 2026-11-11) : page personnelle, hors des moteurs. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return {
    title: id === "nouveau" ? "Envoyer un clip — Rivendy Clips" : "Modifier le clip — Rivendy Clips",
    robots: { index: false, follow: false },
  };
}

export default async function ClipFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClipFormView clipId={decodeURIComponent(id)} />;
}
