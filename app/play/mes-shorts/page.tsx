import type { Metadata } from "next";
import { MyShortsView } from "@/features/play/create/my-shorts";

/** « Mes Shorts » (lot 4, 2026-11-11) : page personnelle, hors des moteurs. */
export const metadata: Metadata = {
  title: "Mes Shorts — Rivendy Play",
  description: "Vos Shorts libres : en vérification, en ligne, refusés.",
  robots: { index: false, follow: false },
};

export default function MyShortsPage() {
  return <MyShortsView />;
}
