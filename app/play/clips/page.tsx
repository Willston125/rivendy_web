import { Suspense } from "react";
import type { Metadata } from "next";
import { ClipsHomeView } from "@/features/play/clips/clips-home";

export const metadata: Metadata = {
  title: "Rivendy Clips — les clips des artistes",
  description: "Les clips musicaux des artistes de Rivendy, toujours gratuits : découvrez, cliquez, regardez, sur le site et dans l’application Rivendy.",
  alternates: { canonical: "/play/clips" },
};

/** Accueil de Rivendy Clips (refonte du 2026-10-26) : filtre et recherche dans l'adresse. */
export default function PlayClipsPage() {
  return (
    <Suspense>
      <ClipsHomeView />
    </Suspense>
  );
}
