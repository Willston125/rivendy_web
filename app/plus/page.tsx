import type { Metadata } from "next";
import { PlusView } from "@/features/plus/plus-view";

export const metadata: Metadata = {
  title: "Rivendy+ — Un abonnement. Tout Rivendy.",
  // Audit 22 (PLAY-2) : la vidéo Premium se lit dans l'application ; la musique,
  // sur le site comme dans l'application. Remettre « sur le site » quand
  // PREMIUM_VIDEO_ON_WEB passe à vrai (features/plus/plus-logic.ts).
  description: "Films et séries Premium dans l’application, musique en écoute complète sur le site et dans l’application.",
  alternates: { canonical: "/plus" },
};

export default function PlusPage() {
  return <PlusView />;
}
