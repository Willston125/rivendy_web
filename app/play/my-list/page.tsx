import type { Metadata } from "next";
import { MyListView } from "@/features/play/play-views";

export const metadata: Metadata = { title: "Ma liste — Rivendy Play", robots: { index: false, follow: false } };

export default function PlayMyListPage() {
  return <MyListView />;
}
