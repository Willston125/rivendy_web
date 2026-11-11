/** Adresses de l'espace artiste et du studio Musique (2026-11-11). */

/** Espace artiste : état du compte, demande ou profil d'artiste. */
export const ARTIST_SPACE = "/music/artiste";

/** Studio : mes sorties. */
export const STUDIO_PATH = "/music/studio";

/** Studio : nouvelle sortie. */
export const NEW_RELEASE_PATH = "/music/studio/nouvelle";

/** Studio : une sortie (brouillon, en vérification, en ligne…). */
export function releaseEditPath(id: string): string {
  return `${STUDIO_PATH}/${encodeURIComponent(id)}`;
}
