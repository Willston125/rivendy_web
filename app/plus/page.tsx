import type { Metadata } from "next";
import { PlusView } from "@/features/plus/plus-view";

export const metadata: Metadata = {
  title: "Rivendy+ — Un abonnement. Tout Rivendy.",
  description: "Films et séries Premium, musique en écoute complète : sur le site et dans l’application.",
  alternates: { canonical: "/plus" },
};

export default function PlusPage() {
  return <PlusView />;
}
