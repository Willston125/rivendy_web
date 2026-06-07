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

/** Choisit le bon lien selon la plateforme détectée (UA). */
export function storeUrlForUA(ua: string): string {
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  if (isIOS && APP_STORE_URL) return APP_STORE_URL;
  if (!isIOS && PLAY_STORE_URL) return PLAY_STORE_URL;
  // Fallback : le premier lien disponible, sinon l'accueil.
  return PLAY_STORE_URL || APP_STORE_URL || "/";
}
