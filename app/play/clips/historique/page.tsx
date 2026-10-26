import type { Metadata } from "next";
import { ClipsHistoryView } from "@/features/play/clips/clips-library";

export const metadata: Metadata = { title: "Historique — Rivendy Clips", robots: { index: false } };

export default function ClipsHistoryPage() {
  return <ClipsHistoryView />;
}
