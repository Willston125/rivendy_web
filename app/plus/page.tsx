import type { Metadata } from "next";
import { PlusView } from "@/features/plus/plus-view";

export const metadata: Metadata = {
  title: "Rivendy+ — Un abonnement. Tout Rivendy.",
  description: "Films et séries Premium, musique en écoute complète, contenus exclusifs : sur le site et dans l’application.",
};

export default function PlusPage() {
  return <PlusView />;
}
