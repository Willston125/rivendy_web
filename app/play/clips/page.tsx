import type { Metadata } from "next";
import { CatalogView } from "@/features/play/play-views";

export const metadata: Metadata = {
  title: "Clips — Rivendy Play",
  description: "Les clips des artistes Rivendy, toujours gratuits, sur le site et dans l’application Rivendy.",
  alternates: { canonical: "/play/clips" },
};

export default function PlayClipsPage() {
  return <CatalogView kind="clip" heading="Clips" intro="Les clips des artistes Rivendy, toujours gratuits." />;
}
