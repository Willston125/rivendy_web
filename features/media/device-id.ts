/**
 * Identifiant d'appareil du navigateur, partagé par la musique et la vidéo
 * (Omnicanal, §10) : le serveur compte les écrans Rivendy+ par appareil — le
 * même navigateur qui écoute puis regarde reste UN écran. Même format que
 * celui attendu par les fonctions du serveur (^[A-Za-z0-9_-]{8,100}$).
 */
const DEVICE_KEY = "rivendy_device_id";

export function deviceId(): string {
  try {
    const kept = localStorage.getItem(DEVICE_KEY);
    if (kept && /^[A-Za-z0-9_-]{8,100}$/.test(kept)) return kept;
    const fresh = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, fresh);
    return fresh;
  } catch {
    return `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** Une vidéo ou la musique : un seul média à la fois sur le site. */
export const MEDIA_PLAY_EVENT = "rivendy:media-play";
