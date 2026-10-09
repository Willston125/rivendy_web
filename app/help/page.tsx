import type { Metadata } from "next";
import { HelpView } from "@/features/help/help-view";

export const metadata: Metadata = {
  title: "Centre d'aide & FAQ — Rivendy",
  description: "Retrouvez les réponses à vos questions sur les commandes, livraisons et retours sur Rivendy.",
};

// `?sujet=payment|selling|…` : sujet pré-choisi quand on arrive du
// portefeuille, du boost ou de l'abonnement.
export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ sujet?: string }>;
}) {
  const { sujet } = await searchParams;
  return <HelpView initialTopic={sujet} />;
}
