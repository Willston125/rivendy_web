import type { Metadata } from "next";
import { HistoryView } from "@/features/play/play-views";

export const metadata: Metadata = { title: "Historique — Rivendy Play", robots: { index: false, follow: false } };

export default function PlayHistoryPage() {
  return <HistoryView />;
}
