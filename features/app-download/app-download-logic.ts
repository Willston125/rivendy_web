/**
 * Page /app « Télécharger l'application » (2026-11-14) — règle pure.
 *
 * Le QR code des vidéos, des affiches et des flyers mène à www.rivendy.com/app :
 * une adresse courte (QR plus facile à lire de loin) qui ne changera pas le jour
 * où une appli iPhone existera.
 *
 * - Android → redirection vers la fiche Google Play (Play Store s'ouvre seul).
 * - iPhone / iPad → aucune appli iOS : la page explique que le site est la porte.
 * - Ordinateur, robots et aperçus de liens → la page elle-même (badge Google Play
 *   + QR code à scanner) : un robot n'est jamais redirigé, l'aperçu montre Rivendy.
 *
 * L'app Android ne revendique PAS /app comme App Link (AndroidManifest : /store,
 * /play/title/, /play/short/, /musique/…, /auth/reset-password) : le lien s'ouvre
 * dans le navigateur, même quand l'app est installée, puis Play Store affiche
 * « Ouvrir ».
 */
export type AppPageTarget =
  | { kind: "android"; url: string }
  | { kind: "ios" }
  | { kind: "other" };

/** Robots d'indexation et d'aperçu de liens (Googlebot smartphone dit aussi « Android »). */
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|lighthouse/i;

export function appPageTarget(ua: string | null | undefined, playUrl: string): AppPageTarget {
  const s = ua ?? "";
  if (!s || BOT_RE.test(s)) return { kind: "other" };
  if (/iPhone|iPad|iPod/.test(s)) return { kind: "ios" };
  if (/Android/i.test(s)) return { kind: "android", url: playUrl };
  return { kind: "other" };
}
