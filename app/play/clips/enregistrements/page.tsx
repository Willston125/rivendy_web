import type { Metadata } from "next";
import { ClipsSavedView } from "@/features/play/clips/clips-library";

export const metadata: Metadata = { title: "Enregistrements — Rivendy Clips", robots: { index: false } };

export default function ClipsSavedPage() {
  return <ClipsSavedView />;
}
