import type { Metadata } from "next";
import { ClipsFollowingView } from "@/features/play/clips/clips-library";

export const metadata: Metadata = { title: "Abonnements — Rivendy Clips", robots: { index: false } };

export default function ClipsFollowingPage() {
  return <ClipsFollowingView />;
}
