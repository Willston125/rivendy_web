import type { Metadata } from "next";
import { HelpView } from "@/features/help/help-view";

export const metadata: Metadata = {
  title: "Centre d'aide & FAQ — Rivendy",
  description: "Retrouvez les réponses à vos questions sur les commandes, livraisons et retours sur Rivendy.",
};

export default function HelpPage() {
  return <HelpView />;
}
