/**
 * « Publier un Short » → « Pour un nouvel article » (lot 4, 2026-11-11) :
 * la vidéo choisie (30 s au plus) passe au formulaire de vente, comme
 * `SellFromPlayShort` dans l'app. Elle vit en mémoire, le temps d'ouvrir
 * /sell ; un rechargement de la page la perd (l'annonce reste possible
 * sans vidéo, ou avec une autre).
 */
let pending: File | null = null;

export function handOffSellVideo(file: File) {
  pending = file;
}

/** La vidéo laissée par « Publier un Short », une seule fois (null : aucune). */
export function takeSellVideo(): File | null {
  const file = pending;
  pending = null;
  return file;
}

/** Durée accordée par le serveur à une vidéo d'article créée depuis Play (`context: 'play'`). */
export const PLAY_VIDEO_SECONDS = 30;
