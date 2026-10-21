import type { Metadata } from "next";
import { CatalogView } from "@/features/play/play-views";

export const metadata: Metadata = {
  title: "Séries — Rivendy Play",
  description: "Les séries de Rivendy Play : saisons, épisodes et reprise de l’épisode en cours, sur le site et dans l’application Rivendy.",
  alternates: { canonical: "/play/series" },
};

export default function PlaySeriesPage() {
  return <CatalogView kind="serie" heading="Séries" intro="Reprenez l’épisode en cours, sur le site comme dans l’application." />;
}
