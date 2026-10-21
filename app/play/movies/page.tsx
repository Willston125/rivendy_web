import type { Metadata } from "next";
import { CatalogView } from "@/features/play/play-views";

export const metadata: Metadata = {
  title: "Films — Rivendy Play",
  description: "Les films de Rivendy Play, à regarder sur le site et dans l’application Rivendy.",
  alternates: { canonical: "/play/movies" },
};

export default function PlayMoviesPage() {
  return <CatalogView kind="film" heading="Films" intro="Les films de Rivendy Play, sur le site et dans l’application." />;
}
