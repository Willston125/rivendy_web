import type { Metadata } from "next";
import { SearchView } from "@/features/play/play-views";

export const metadata: Metadata = { title: "Recherche — Rivendy Play", robots: { index: false, follow: true } };

/**
 * La saisie vit dans la coque (barre du haut et page partagent la même) :
 * elle est reprise de l'adresse (?q=…) à l'arrivée, puis l'adresse la suit
 * sans recharger la page.
 */
export default function PlaySearchPage() {
  return <SearchView />;
}
