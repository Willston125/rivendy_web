import { notFound, permanentRedirect } from "next/navigation";
import { titlePath } from "@/features/play/play-logic";
import { getTitle } from "@/features/play/server/play-server";

/**
 * Ancienne adresse d'un film, d'une série ou d'un clip (lot K de l'audit 16).
 * Omnicanal lot C (§15) : redirection PERMANENTE vers l'adresse canonique
 * selon le type — les liens déjà partagés sur WhatsApp ou Facebook continuent
 * de marcher. Avec l'app installée, Android ouvre toujours ce chemin dans
 * l'app (App Link existant) : le bouton « Ouvrir dans l'app » l'utilise.
 */
export default async function PlayTitleLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTitle(id);
  if (!t) notFound();
  permanentRedirect(titlePath(t));
}
