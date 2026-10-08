/**
 * Adresses de destination sûres (audit du 2026-10-06).
 *
 * Deux défauts de même famille — une adresse venue de l'extérieur reprise
 * telle quelle comme destination de navigation :
 *
 * 1. `/auth/login?next=…` : après la connexion, `router.push(next)` suivait
 *    n'importe quelle adresse, y compris `https://site-pirate.example` ou
 *    `//site-pirate.example`. Un lien piégé « connectez-vous pour continuer »
 *    renvoyait l'utilisateur, juste connecté, sur une page de phishing.
 * 2. Lien publicitaire `external` : `link_value` (saisi au dashboard) était
 *    repris tel quel. Sans `https://` il devenait un chemin relatif
 *    (`/google.fr` → 404, constaté en production) ; avec `javascript:` il
 *    aurait exécuté du code.
 */

/**
 * Chemin interne sûr pour une redirection après connexion : commence par
 * un seul « / », ne contient ni `\`, ni caractère de contrôle. Tout le
 * reste retombe sur [fallback].
 */
export function safeInternalPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}

/**
 * Adresse externe d'une publicité : `http(s)` seulement. Une adresse sans
 * schéma mais qui ressemble à un domaine (`google.fr`) reçoit `https://`.
 * Sinon `null` (le lien n'est pas rendu cliquable).
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) {
    try {
      return new URL(value).toString();
    } catch {
      return null;
    }
  }
  // Un autre schéma (javascript:, data:, mailto: …) n'est pas une publicité web.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  // « domaine.tld[/chemin] » sans schéma.
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(?::\d+)?([/?#].*)?$/i.test(value)) {
    try {
      return new URL(`https://${value}`).toString();
    } catch {
      return null;
    }
  }
  return null;
}
