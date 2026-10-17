/**
 * Liens de téléchargement de l'application mobile Rivendy.
 * À renseigner via les variables d'environnement Vercel quand l'app est publiée :
 *   NEXT_PUBLIC_PLAY_STORE_URL  (Google Play)
 *   NEXT_PUBLIC_APP_STORE_URL   (Apple App Store)
 * Tant qu'elles sont vides, la bannière pointe vers la page d'accueil.
 */
export const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || "";
export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || "";

/** Au moins un lien store est-il configuré ? */
export const HAS_APP_LINKS = Boolean(PLAY_STORE_URL || APP_STORE_URL);

/**
 * Choisit le bon lien selon la plateforme détectée (UA). null : aucune app
 * pour cet appareil — audit 17 (WEB-24) : un iPhone était envoyé vers
 * Google Play, où rien ne s'installe.
 */
export function storeUrlForUA(ua: string): string | null {
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  if (isIOS) return APP_STORE_URL || null;
  return PLAY_STORE_URL || null;
}
