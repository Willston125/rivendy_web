import type { Metadata } from "next";
import { ShortFlowView } from "@/features/play/create/short-flow";

/** « Publier un Short » depuis le site (lot 4, 2026-11-11) : page personnelle, hors des moteurs. */
export const metadata: Metadata = {
  title: "Publier un Short — Rivendy Play",
  description: "Publiez un Short de 30 secondes : pour un article, ou un Short libre vérifié par Rivendy.",
  robots: { index: false, follow: false },
};

export default function PublishShortPage() {
  return <ShortFlowView />;
}
