/**
 * Publier des vidéos depuis le site (lots 3 et 4, 2026-11-11, canevas
 * validé) — règles PURES, miroir de l'app :
 *  - clips d'artiste : `ArtistLimits`, `clipFileProblem`, `artistTextProblem`
 *    et `artistErrorMessage` (artist_models.dart) ;
 *  - Shorts : `freeShortCaptionProblem`, `PlayShortRules`, `MyShort` et
 *    `MyShortArticle` (play_create_service.dart), messages de
 *    play_short_flow.dart ;
 *  - qui peut commenter : `commentModeLabel` / `commentModeHint` ;
 *  - envoi : codes de `VideoException.fromCode` et `TusUploader`
 *    (video_service.dart).
 * Les plafonds font foi CÔTÉ SERVEUR (create-video-upload, play_submit_*) :
 * ici, seulement ce qui évite un envoi voué à l'échec. Aucun import
 * d'exécution : `node --test` lit ce fichier tel quel (npm run check:create).
 */

/** Clip d'artiste : 10 min, 200 Mo, 10 par mois (miroir d'ArtistLimits). */
export const CLIP = {
  maxSeconds: 600,
  minSeconds: 5,
  maxBytes: 200 * 1024 * 1024,
  perMonth: 10,
  titleMax: 120,
  descriptionMax: 1000,
  genreMax: 40,
} as const;

/** Short : 30 s, légende de 300 signes (miroir de VideoLimits et kFreeShortCaptionMax). */
export const SHORT = { maxSeconds: 30, captionMax: 300 } as const;

/**
 * Envoi reprenable (tus), miroir du TusUploader de l'app : morceaux de 5 Mio
 * (minimum de Cloudflare), jusqu'à 5 reprises de suite (1, 2, 4, 8, 16 s).
 */
export const TUS = { chunkBytes: 5 * 1024 * 1024, maxRetries: 5 } as const;

/** Attente avant la reprise n° `failures` (1 → 1 s, 5 → 16 s). */
export function retryDelayMs(failures: number): number {
  return 1000 * 2 ** Math.max(0, failures - 1);
}

/** Réponse d'un morceau qui demande de relire la position (décalage, serveur occupé). */
export function isRetryableStatus(status: number): boolean {
  return status === 409 || status === 408 || status === 429 || status >= 500 || status === 0;
}

/** Position renvoyée par Cloudflare (`Upload-Offset`), sinon null. */
export function parseOffset(header: string | null | undefined): number | null {
  if (!header || !/^\d+$/.test(header.trim())) return null;
  const n = Number(header.trim());
  return Number.isSafeInteger(n) ? n : null;
}

// ── Textes ───────────────────────────────────────────────────────────────────

export const CONTACT_MESSAGE = "Pas de numéro, de WhatsApp ni de lien : tout contact passe par Rivendy.";

/** Règle Contact, miroir de play_text_has_contact (serveur) et hasContactInfo (app). */
export function hasContact(text: string): boolean {
  const digits = text.replace(/[\s.\-()/]/g, "");
  return /\d{7,}/.test(digits)
    || /whats\s*app|watsap|https?:\/\/|www\.|telegram/i.test(text)
    || /[a-z0-9-]+\.(com|me|net|org|fr|km|dj|ly)([^a-z]|$)/i.test(text);
}

/** Texte libre d'un clip (miroir d'artistTextProblem). */
export function clipTextProblem(text: string, opts: { max: number; field: string; min?: number }): string | null {
  const t = text.trim();
  const min = opts.min ?? 0;
  if (t.length < min) return min <= 1 ? `${opts.field} obligatoire.` : `${opts.field} : ${min} caractères au moins.`;
  if (t.length > opts.max) return `${opts.field} trop long (${opts.max} caractères au plus).`;
  if (hasContact(t)) return CONTACT_MESSAGE;
  return null;
}

/** Premier problème du formulaire d'un clip, dans l'ordre de l'app (`_validate`), ou null. */
export function clipFormProblem(f: { editing: boolean; hasVideo: boolean; title: string; description: string; genre: string }): string | null {
  if (!f.editing && !f.hasVideo) return "Choisissez la vidéo du clip.";
  return clipTextProblem(f.title, { min: 1, max: CLIP.titleMax, field: "Titre" })
    ?? clipTextProblem(f.description, { max: CLIP.descriptionMax, field: "Description" })
    ?? clipTextProblem(f.genre, { max: CLIP.genreMax, field: "Genre" });
}

/**
 * Légende d'un Short libre (miroir de freeShortCaptionProblem). Le filtre de
 * mots est celui du site (`ContentFilter`), passé en paramètre : ce fichier
 * reste sans import.
 */
export function freeShortCaptionProblem(caption: string, hasBannedWord?: (text: string) => boolean): string | null {
  const text = caption.trim();
  if (text.length > SHORT.captionMax) return `Légende trop longue (${SHORT.captionMax} signes au plus).`;
  const digits = text.replace(/[\s.\-()/]/g, "");
  if (/\+?\d{7,}/.test(digits) || /whats\s*app|watsap/i.test(text)) return CONTACT_MESSAGE;
  if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|me|net|org|fr|km|dj|ly)\b/i.test(text)) {
    return "Pas de lien dans la légende : tout contact passe par Rivendy.";
  }
  if (hasBannedWord?.(text)) return "La légende contient un mot non autorisé.";
  return null;
}

/** Règles d'un Short libre (PlayShortRules.lines), acceptées avant le premier envoi. */
export const SHORT_RULES = [
  "Une vidéo que vous avez filmée vous-même, ou dont vous avez les droits.",
  "Pas de musique protégée sans autorisation.",
  "Ni nudité, ni violence, ni haine, ni arnaque.",
  "Pas de numéro, de WhatsApp ni de lien : tout contact passe par Rivendy.",
  "Respectez les personnes filmées : leur accord d’abord.",
] as const;

/** Mémoire locale « règles acceptées » (même clé que l'app ; le serveur exige p_accept_rules à chaque dépôt). */
export const SHORT_RULES_KEY = "play_short_rules_accepted_v1";

// ── Fichiers vidéo ───────────────────────────────────────────────────────────

export const UNREADABLE_VIDEO = "Cette vidéo ne peut pas être lue. Choisissez un fichier MP4 ou MOV.";

/** « 3:42 », « 0:24 » (secondes arrondies). */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** « 86 Mo » (arrondi au Mo, au moins 1). */
export function megabytes(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / (1024 * 1024)))} Mo`;
}

/** Vidéo choisie pour un clip (miroir de clipFileProblem ; durée illisible = fichier illisible). */
export function clipFileProblem(durationSeconds: number, bytes: number): string | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return UNREADABLE_VIDEO;
  if (durationSeconds > CLIP.maxSeconds + 1) return `Clip trop long : ${CLIP.maxSeconds / 60} minutes au plus.`;
  if (durationSeconds < CLIP.minSeconds) return "Vidéo trop courte.";
  if (bytes > CLIP.maxBytes) return "Fichier trop lourd (200 Mo au plus) : exportez le clip en 720p puis réessayez.";
  return null;
}

/**
 * Vidéo d'un Short : 30 s au plus. L'app propose un outil de coupe ; le site
 * n'en a pas (choix validé avec le canevas) : l'écran explique comment couper
 * la vidéo sur le téléphone. Marge de 0,5 s, comme le formulaire de vente.
 */
export function shortFileProblem(durationSeconds: number): string | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return UNREADABLE_VIDEO;
  if (durationSeconds > SHORT.maxSeconds + 0.5) return `Votre vidéo dure ${clock(durationSeconds)} : ${SHORT.maxSeconds} secondes au plus.`;
  if (durationSeconds < 1) return "Vidéo trop courte.";
  return null;
}

// ── Mes Shorts ───────────────────────────────────────────────────────────────

export type ShortState = { status: string; video_status: string | null; moderation_reason: string | null };

/** Ce que l'auteur lit sur son Short (miroir de MyShort.statusLabel). */
export function shortStatusLabel(s: ShortState): string {
  switch (s.status) {
    case "published": return s.video_status === "ready" ? "En ligne" : "Vidéo en préparation";
    case "rejected": return "Refusé";
    case "removed": return "Retiré";
    default: return s.moderation_reason?.trim() ? "À revérifier" : "En vérification";
  }
}

export function shortIsOnline(s: ShortState): boolean {
  return s.status === "published" && s.video_status === "ready";
}

export type StatusTone = "online" | "pending" | "neutral" | "rejected";

/** Couleur du statut : vert en ligne, ambre en attente, gris neutre, rouge refusé. */
export function shortStatusTone(s: ShortState): StatusTone {
  if (shortIsOnline(s)) return "online";
  if (s.status === "rejected") return "rejected";
  if (s.status === "removed" || s.status === "published") return "neutral";
  return "pending";
}

// ── Articles d'un Short ──────────────────────────────────────────────────────

/** Statuts où un article peut recevoir un Short (kShortArticleStatuses). */
export const SHORT_ARTICLE_STATUSES = ["active", "boosted", "pending", "epuise"] as const;

export type ShortArticle = { id: string; title: string; photo: string | null; status: string; hasVideo: boolean };

/** Une ligne `products` → article proposable (miroir de MyShortArticle.fromRow). */
export function toShortArticle(row: { id: string; title?: string | null; photos?: unknown; status?: string | null; video_uid?: string | null }): ShortArticle {
  const title = (row.title ?? "").trim();
  const photos = Array.isArray(row.photos) ? row.photos : [];
  return {
    id: row.id,
    title: title || "Article sans titre",
    photo: photos.length > 0 && typeof photos[0] === "string" ? photos[0] : null,
    status: row.status ?? "pending",
    hasVideo: typeof row.video_uid === "string" && row.video_uid.length > 0,
  };
}

/** Mention sur la vignette (null : en vente). */
export function articleStatusNote(status: string): string | null {
  return status === "pending" ? "En attente" : status === "epuise" ? "Épuisé" : status === "boosted" ? "Boosté" : null;
}

function foldText(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Recherche (sans accents ni majuscules) et filtre « Sans vidéo » (filterShortArticles). */
export function filterShortArticles(all: ShortArticle[], query = "", withoutVideoOnly = false): ShortArticle[] {
  const q = foldText(query.trim());
  return all.filter((a) => (!withoutVideoOnly || !a.hasVideo) && (q === "" || foldText(a.title).includes(q)));
}

// ── Messages ─────────────────────────────────────────────────────────────────

const RETRY_LATER = "Trop d’envois d’affilée : réessayez dans une minute.";

/** Refus de create-video-upload pour une vidéo d'article ou un Short (VideoException.fromCode). */
export function videoTicketMessage(code: string | null | undefined, limit?: number | null): string {
  switch (code) {
    case "QUOTA_EXCEEDED":
      return limit != null
        ? `Quota vidéo atteint (${limit} ce mois-ci). Passez à une formule supérieure pour en publier plus.`
        : "Quota vidéo atteint. Passez à une formule supérieure pour en publier plus.";
    case "UNAUTHENTICATED": return "Connectez-vous pour publier une vidéo.";
    case "RATE_LIMITED": return RETRY_LATER;
    case "BAD_LENGTH": return "Fichier trop lourd pour être envoyé (1 Go au plus).";
    default: return "L’envoi de la vidéo a échoué, réessayez.";
  }
}

/** Refus pour un clip, à la demande d'envoi comme au dépôt (artistErrorMessage). */
export function clipErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case "not_authenticated":
    case "UNAUTHENTICATED": return "Connectez-vous pour continuer.";
    case "too_long":
    case "bad_text": return "Un des textes est trop long.";
    case "contact_forbidden": return CONTACT_MESSAGE;
    case "suspended": return "Votre compte artiste est suspendu.";
    case "artist_required":
    case "ARTIST_REQUIRED": return "Votre compte artiste doit être validé par Rivendy avant d’envoyer un clip.";
    case "QUOTA_EXCEEDED": return `Vous avez déjà envoyé ${CLIP.perMonth} clips ce mois-ci.`;
    case "RATE_LIMITED": return RETRY_LATER;
    case "BAD_LENGTH": return "Fichier trop lourd (200 Mo au plus) : exportez le clip en 720p puis réessayez.";
    case "video_not_found":
    case "already_submitted": return "La vidéo n’a pas été reçue, réessayez.";
    case "not_found":
    case "not_allowed": return "Action impossible sur ce clip.";
    default: return "Action impossible pour le moment, réessayez.";
  }
}

/** Refus au dépôt d'un Short libre (play_submit_short). */
export function shortSubmitMessage(code: string | null | undefined): string {
  switch (code) {
    case "caption_too_long": return `Légende trop longue (${SHORT.captionMax} signes au plus).`;
    case "no_market": return "Choisissez d’abord votre pays dans votre profil.";
    case "not_authenticated": return "Connectez-vous pour publier un Short.";
    case "contact_forbidden": return CONTACT_MESSAGE;
    case "sanctioned": return "Votre compte ne peut plus publier ni commenter sur Rivendy Play et Rivendy Musique. Contactez Rivendy.";
    case "rules_not_accepted": return "Acceptez les règles de publication pour envoyer votre Short.";
    default: return "L’envoi du Short a échoué, réessayez.";
  }
}

/** Fin d'un envoi réussi, selon le cas (mêmes phrases que l'app). */
export const DONE_MESSAGE = {
  clip: "Clip envoyé : Rivendy le vérifie avant de le publier.",
  freeShort: "Short envoyé : Rivendy le vérifie avant de le publier. Suivez-le dans « Mes Shorts ».",
  articlePending: "Short envoyé : il apparaît dans les Shorts dès que l’article est validé.",
  articleOnline: "Short envoyé : Rivendy vérifie la nouvelle vidéo avant de la montrer dans les Shorts.",
} as const;

// ── Qui peut commenter ───────────────────────────────────────────────────────

export type CommentsMode = "all" | "followers" | "none";
export const COMMENTS_MODES: readonly CommentsMode[] = ["all", "followers", "none"];

export function commentsModeOf(v: string | null | undefined): CommentsMode {
  return v === "followers" || v === "none" ? v : "all";
}

/** commentModeLabel de l'app. */
export function commentsModeLabel(mode: string | null | undefined): string {
  const m = commentsModeOf(mode);
  return m === "followers" ? "Mes abonnés" : m === "none" ? "Personne" : "Tout le monde";
}

/** commentModeHint de l'app. */
export function commentsModeHint(mode: string | null | undefined): string {
  const m = commentsModeOf(mode);
  return m === "followers"
    ? "Seuls les comptes abonnés à votre chaîne commentent."
    : m === "none" ? "Commentaires fermés ; vous pouvez toujours écrire." : "Tout compte Rivendy peut commenter.";
}
