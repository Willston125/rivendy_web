import { PlayLinkPage } from "@/features/play/play-link-page";

/**
 * Vidéo Rivendy Play introuvable (retiré, jamais publié, lien abîmé) : statut 404 pour
 * les moteurs et les aperçus de liens — audit 17, WEB-21 (c'était 200) —,
 * avec le même écran « indisponible » et ses liens vers l'application.
 */
export default function NotFound() {
  return <PlayLinkPage path="/play" content={null} />;
}
