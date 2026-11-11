/** Adresses des pages « publier une vidéo » (lots 3 et 4, 2026-11-11). */
export const SHORT_NEW_PATH = "/play/shorts/nouveau";
export const MY_SHORTS_PATH = "/play/mes-shorts";
export const CLIP_SPACE_PATH = "/play/clips/artiste";
export const CLIP_NEW_PATH = "/play/clips/artiste/nouveau";

export function clipEditPath(id: string): string {
  return `${CLIP_SPACE_PATH}/${encodeURIComponent(id)}`;
}

/** Page publique d'un Short du public (lien partagé, déjà sur le site). */
export function shortPublicPath(id: string): string {
  return `/play/short/public/${encodeURIComponent(id)}`;
}
