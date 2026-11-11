// Rivendy Musique — publier depuis le site (lots 0 à 2, 2026-11-11).
// MIROIR des règles PURES de l'app : studio_models.dart (sorties, titres,
// fichiers audio), artist_models.dart (profil d'artiste),
// musique_publish_sheet.dart (feuille « Publier ») et musique_origins.dart.
// Le serveur (music_artist_*, play_artist_save, musique-artist-upload) garde
// le dernier mot : ces règles évitent un aller-retour, et surtout l'envoi d'un
// fichier pour rien sur une connexion lente et payante.
// node --test features/music/studio/studio-logic.test.mjs (npm run check:studio)

import type { ReleaseState } from "../music-logic";
import type { ArtistStatus } from "../../play/clips/clips-logic";

// ── Sorties et titres (studio_models.dart) ──────────────────────────────────

/** Limites des sorties : miroir de StudioLimits (D11 de la spec). */
export const STUDIO = {
  releasesPerMonth: 10,
  titleMax: 120,
  featuringMax: 200,
  descriptionMax: 1000,
  maxFileBytes: 200 * 1024 * 1024,
  extensions: ["mp3", "m4a", "wav", "flac"],
} as const;

export type StudioKind = "single" | "ep" | "album";
export const STUDIO_KINDS: readonly StudioKind[] = ["single", "ep", "album"];

/** Titres au plus par type de sortie. */
export function tracksFor(kind: string): number {
  return kind === "single" ? 3 : kind === "ep" ? 8 : 30;
}

/** Même règle que music_artist_editable_release() : brouillon ou refusée. */
export function isEditable(state: ReleaseState): boolean {
  return state === "draft" || state === "rejected";
}

/** Le fichier d'un titre est-il arrivé (reçu, en préparation ou prêt) ? */
export function trackHasFile(audioStatus: string | null | undefined): boolean {
  return audioStatus === "uploaded" || audioStatus === "processing" || audioStatus === "ready";
}

/** État du fichier d'un titre, comme l'éditeur de l'app (_trackStatus). */
export function trackStatusLabel(audioStatus: string | null | undefined): string {
  switch (audioStatus) {
    case "uploaded": return "Fichier reçu";
    case "processing": return "En préparation";
    case "ready": return "Prêt";
    case "error": return "Erreur — renvoyez le fichier";
    default: return "Fichier manquant";
  }
}

export type SubmitCheck = {
  state: ReleaseState;
  hasCover: boolean;
  hasGenre: boolean;
  tracks: Array<{ hasFile: boolean }>;
  attested: boolean;
};

/** Ce qui empêche encore d'envoyer la sortie (null : prête). Miroir de studioSubmitProblem. */
export function submitProblem(c: SubmitCheck): string | null {
  if (!isEditable(c.state)) return "Cette sortie ne peut plus être envoyée.";
  if (!c.hasCover) return "Ajoutez une pochette.";
  if (!c.hasGenre) return "Choisissez un genre.";
  if (c.tracks.length === 0) return "Ajoutez au moins un titre.";
  const missing = c.tracks.filter((t) => !t.hasFile).length;
  if (missing > 0) return missing === 1 ? "Un titre n’a pas encore son fichier." : `${missing} titres n’ont pas encore leur fichier.`;
  if (!c.attested) return "Cochez l’attestation des droits.";
  return null;
}

export type ChecklistItem = { key: "cover" | "genre" | "tracks" | "files" | "attest"; ok: boolean; label: string };

/**
 * Liste « Avant l'envoi » du site : les mêmes conditions que submitProblem,
 * toutes à la fois (l'app n'en montre qu'une).
 */
export function submitChecklist(c: Omit<SubmitCheck, "state">): ChecklistItem[] {
  const n = c.tracks.length;
  const missing = c.tracks.filter((t) => !t.hasFile).length;
  return [
    { key: "cover", ok: c.hasCover, label: c.hasCover ? "Pochette ajoutée" : "Ajoutez une pochette" },
    { key: "genre", ok: c.hasGenre, label: c.hasGenre ? "Genre choisi" : "Choisissez un genre" },
    { key: "tracks", ok: n > 0, label: n > 0 ? `${n} titre${n > 1 ? "s" : ""}` : "Ajoutez au moins un titre" },
    {
      key: "files",
      ok: n > 0 && missing === 0,
      label: n === 0 ? "Chaque titre avec son fichier"
        : missing === 0 ? "Chaque titre a son fichier"
        : missing === 1 ? "1 titre sans fichier" : `${missing} titres sans fichier`,
    },
    { key: "attest", ok: c.attested, label: c.attested ? "Droits attestés" : "Attestation des droits à cocher" },
  ];
}

/** Fichier audio acceptable pour l'envoi (null : oui). Miroir de studioFileProblem. */
export function fileProblem(name: string, size: number): string | null {
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  if (!(STUDIO.extensions as readonly string[]).includes(ext)) return `« ${name} » : MP3, M4A, WAV ou FLAC seulement.`;
  if (size <= 0) return `« ${name} » est vide.`;
  if (size > STUDIO.maxFileBytes) return `« ${name} » dépasse 200 Mo.`;
  return null;
}

/** Titre proposé d'après le nom du fichier : « 02 - Twarab ya Moroni.mp3 » → « Twarab ya Moroni ». */
export function titleFromFile(name: string): string {
  let base = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;
  base = base.replace(/_+/g, " ");
  base = base.replace(/^\s*\d{1,3}\s*[-.)_ ]\s*/, "");
  base = base.replace(/\s+/g, " ").trim();
  if (!base) return "Titre";
  return base.length > STUDIO.titleMax ? base.slice(0, STUDIO.titleMax) : base;
}

/** « 1 écoute », « 1 250 écoutes » (espace fine entre les milliers). */
export function playsLabel(n: number): string {
  const s = String(Math.max(0, Math.trunc(n))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${s} écoute${n > 1 ? "s" : ""}`;
}

/** « Mo » lisible : 28,4 Mo. */
export function megabytesLabel(bytes: number): string {
  const mo = bytes / (1024 * 1024);
  return `${mo.toLocaleString("fr-FR", { maximumFractionDigits: mo < 10 ? 1 : 0 })} Mo`;
}

/** Date « AAAA-MM-JJ » (p_release_date), dans le fuseau de l'appareil comme l'app. */
export function isoDay(d: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getFullYear(), 4)}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Message affichable pour un refus du serveur (RPC ou fonction). Miroir de studioErrorMessage. */
export function studioErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case "not_authenticated": return "Connectez-vous pour continuer.";
    case "artist_required":
    case "ARTIST_REQUIRED": return "Votre compte artiste doit être validé par Rivendy.";
    case "quota_exceeded": return `Vous avez atteint ${STUDIO.releasesPerMonth} sorties ce mois-ci.`;
    case "too_many_tracks": return "Ce type de sortie ne peut pas contenir plus de titres.";
    case "not_editable": return "Cette sortie n’est plus modifiable (en vérification ou en ligne).";
    case "bad_title": return `Le titre doit faire de 1 à ${STUDIO.titleMax} caractères.`;
    case "featuring_too_long": return `Le featuring dépasse ${STUDIO.featuringMax} caractères.`;
    case "description_too_long": return `La présentation dépasse ${STUDIO.descriptionMax} caractères.`;
    case "bad_cover": return "La pochette n’a pas été reconnue, choisissez-la de nouveau.";
    case "bad_genre": return "Ce genre n’est plus proposé.";
    case "bad_island": return "Cette origine n’est plus proposée, choisissez-en une autre.";
    case "bad_date": return "Date de sortie invalide.";
    case "rights_not_attested": return "Cochez l’attestation des droits.";
    case "no_cover": return "Ajoutez une pochette.";
    case "no_genre": return "Choisissez un genre.";
    case "no_tracks": return "Ajoutez au moins un titre.";
    case "track_without_audio": return "Chaque titre doit avoir son fichier.";
    case "not_withdrawable": return "Cette sortie ne peut pas être retirée.";
    case "bad_format": return "Format accepté : MP3, M4A, WAV ou FLAC.";
    case "too_large": return "Le fichier dépasse 200 Mo.";
    case "file_not_found": return "Le fichier n’est pas arrivé, renvoyez-le.";
    case "too_many_requests": return "Trop d’envois d’un coup, patientez quelques minutes.";
    case "storage_unavailable": return "Le stockage ne répond pas, réessayez plus tard.";
    case "bad_size": return "La taille du fichier n’a pas été reconnue, renvoyez-le.";
    case "empty_file": return "Le fichier est vide, choisissez-en un autre.";
    case "bad_key": return "L’envoi n’a pas été reconnu, recommencez l’ajout du fichier.";
    case "attach_failed": return "Le fichier est arrivé mais n’a pas pu être rattaché au titre, réessayez.";
    case "lookup_failed": return "Le stockage n’a pas pu vérifier le fichier, réessayez dans un instant.";
    default: return "Une erreur est survenue, réessayez.";
  }
}

// ── Profil d'artiste (artist_models.dart) ───────────────────────────────────

/** Limites du profil : miroir de ArtistLimits. */
export const ARTIST = { nameMin: 2, nameMax: 60, genreMax: 40, bioMax: 500 } as const;

/**
 * Règle Contact de Rivendy : ni numéro, ni WhatsApp, ni lien — MIROIR de
 * hasContactInfo (app) et de play_text_has_contact (serveur).
 */
export function hasContactInfo(text: string): boolean {
  const digits = text.replace(/[\s.\-()/]/g, "");
  return /\d{7,}/.test(digits)
    || /whats\s*app|watsap|https?:\/\/|www\.|telegram/i.test(text)
    || /[a-z0-9-]+\.(com|me|net|org|fr|km|dj|ly)([^a-z]|$)/i.test(text);
}

/** Problème d'un texte libre du profil, ou null. Miroir de artistTextProblem. */
export function artistTextProblem(text: string, o: { max: number; field: string; min?: number }): string | null {
  const t = text.trim();
  const min = o.min ?? 0;
  if (t.length < min) return min <= 1 ? `${o.field} obligatoire.` : `${o.field} : ${min} caractères au moins.`;
  if (t.length > o.max) return `${o.field} trop long (${o.max} caractères au plus).`;
  if (hasContactInfo(t)) return "Pas de numéro, de WhatsApp ni de lien : tout contact passe par Rivendy.";
  return null;
}

/** Ce qui empêche d'envoyer le profil (null : prêt). Miroir de _validate du formulaire de l'app. */
export function artistProfileProblem(p: { name: string; genre: string; bio: string; rules: boolean; nameLocked?: boolean }): string | null {
  return (p.nameLocked ? null : artistTextProblem(p.name, { min: ARTIST.nameMin, max: ARTIST.nameMax, field: "Nom d’artiste" }))
    ?? artistTextProblem(p.genre, { max: ARTIST.genreMax, field: "Genre musical" })
    ?? artistTextProblem(p.bio, { max: ARTIST.bioMax, field: "Biographie" })
    ?? (p.rules ? null : "Acceptez les règles des artistes pour continuer.");
}

/** Message affichable pour un refus du serveur (espace artiste). Miroir de artistErrorMessage. */
export function artistErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case "not_authenticated":
    case "UNAUTHENTICATED": return "Connectez-vous pour continuer.";
    case "rules_not_accepted": return "Acceptez les règles des artistes pour continuer.";
    case "bad_name": return "Nom d’artiste : 2 à 60 caractères.";
    case "too_long":
    case "bad_text": return "Un des textes est trop long.";
    case "contact_forbidden": return "Pas de numéro, de WhatsApp ni de lien : tout contact passe par Rivendy.";
    case "bad_image": return "Image refusée : choisissez-la à nouveau.";
    case "no_market": return "Choisissez d’abord votre pays dans votre profil.";
    case "suspended": return "Votre compte artiste est suspendu.";
    case "name_locked": return "Votre nom d’artiste est validé : demandez son changement à Rivendy.";
    case "has_music": return "Vous avez de la musique en ligne sur Rivendy Musique : retirez-la avant de passer en « clips seulement ».";
    case "not_approved": return "Votre compte artiste doit d’abord être validé par Rivendy.";
    case "same_name": return "C’est déjà votre nom d’artiste.";
    case "bad_origin": return "Cette origine n’est plus proposée, choisissez-en une autre.";
    default: return "Action impossible pour le moment, réessayez.";
  }
}

// ── Feuille « Publier » de la Musique (musique_publish_sheet.dart) ──────────

export type PublishPhase = "login" | "loading" | "error" | "become" | "follow" | "enable" | "publish";

/** Ce que propose la feuille « Publier » selon le compte, comme l'app. */
export function publishPhase(p: {
  signedIn: boolean; loading: boolean; error: boolean; status: ArtistStatus; musicEnabled: boolean | null | undefined;
}): PublishPhase {
  if (!p.signedIn) return "login";
  if (p.loading) return "loading";
  if (p.error) return "error";
  if (p.status === "none") return "become";
  if (p.status !== "approved") return "follow";
  return p.musicEnabled === false ? "enable" : "publish";
}

/** Texte de la feuille pour un compte artiste pas (ou plus) validé. */
export function followMessage(status: ArtistStatus, reason: string | null | undefined): string {
  if (status === "pending") return "Votre demande de compte artiste est en vérification. Vous serez prévenu par une notification.";
  if (status === "rejected") return `Votre demande de compte artiste n’a pas été acceptée.${reason ? ` Motif : ${reason}` : ""}`;
  return "Votre compte artiste est suspendu : la publication est fermée pour le moment.";
}

// ── Origines (musique_origins.dart) ─────────────────────────────────────────

export type Origin = {
  id: string; name: string; kind: string; parent_id: string | null; iso: string | null; country_id: string | null;
};

const byName = (a: Origin, b: Origin) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" });

/** Pays par ordre alphabétique (accents ignorés), chacun avec ses régions et îles. */
export function originGroups(origins: Origin[]): Array<{ country: Origin; children: Origin[] }> {
  const countries = origins.filter((o) => o.kind === "country").sort(byName);
  return countries.map((country) => ({
    country,
    children: origins.filter((o) => o.parent_id === country.id).sort(byName),
  }));
}

/** « Ngazidja · Comores », « Sénégal » ; vide si inconnue. */
export function originLabel(origins: Origin[], id: string | null | undefined): string {
  if (!id) return "";
  const o = origins.find((x) => x.id === id);
  if (!o) return "";
  if (o.kind === "country" || !o.parent_id) return o.name;
  const country = origins.find((x) => x.id === o.parent_id);
  return country ? `${o.name} · ${country.name}` : o.name;
}
