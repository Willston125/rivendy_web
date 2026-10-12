import type { Metadata } from "next";
import { PlayPremiumView } from "@/features/play/play-premium-view";

export const metadata: Metadata = {
  title: "Pass Premium Rivendy Play — Rivendy",
  description:
    "Films et séries Premium de Rivendy Play : choisissez votre pass 24 h, 7 jours ou 30 jours et payez par mobile money.",
};

// Page publique : l'offre se lit sans compte ; la demande exige la connexion
// (le pass s'active sur le compte Rivendy).
export default function PlayPremiumPage() {
  return <PlayPremiumView />;
}
