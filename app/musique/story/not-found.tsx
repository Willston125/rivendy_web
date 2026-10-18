import { MusiqueLinkPage } from "@/features/musique/musique-link-page";

/**
 * Story Rivendy Musique introuvable (expirée après 24 h, retirée, lien abîmé) :
 * statut 404, comme les autres liens Musique (audit 17, WEB-21), avec ses liens
 * vers l'application — spec 2026-10-17 §7.
 */
export default function NotFound() {
  return <MusiqueLinkPage path="/" content={null} unavailableTitle="Cette story n’est plus disponible" />;
}
