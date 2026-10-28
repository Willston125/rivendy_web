/**
 * Rivendy Music sur le site — règles PURES (Omnicanal lot D, 2026-10-21).
 * Miroir de l'app 1.4.9 (`lib/features/musique/logic/musique_logic.dart`,
 * `musique_queue.dart`, `core/utils/storage_thumb.dart`) : mêmes seuils, même
 * façon de compter, mêmes vignettes. Sans import : testé sous Node par
 * `node --test features/music/music-logic.test.mjs` (npm run check:music).
 * Les vraies règles d'argent (écoute payable, plafonds, Premium) restent dans
 * les fonctions du serveur ; ce fichier ne décide rien de ce qui se paie.
 */

/** Colonnes LUES (jamais `select('*')` : les fichiers audio sont fermés aux clients). */
export const RELEASE_COLUMNS =
  "id, kind, title, artist_id, artist_name, featuring, description, cover_url, genre_id, country_id, island_id, release_date, is_premium, explicit, featured_rank, published_at, play_artists(name)";
export const TRACK_COLUMNS =
  "id, release_id, position, title, featuring, duration_seconds, has_preview, audio_status, is_free, explicit, allow_shorts";
export const ARTIST_COLUMNS = "id, user_id, name, genre, country_id, bio, avatar_url, banner_url, island_id";

export interface MusicRelease {
  id: string;
  kind: string;
  title: string;
  artist_id: string | null;
  artist_name?: string | null;
  featuring?: string | null;
  description?: string | null;
  cover_url?: string | null;
  genre_id?: string | null;
  country_id?: string | null;
  island_id?: string | null;
  release_date?: string | null;
  is_premium?: boolean | null;
  explicit?: boolean | null;
  featured_rank?: number | null;
  published_at?: string | null;
  play_artists?: { name?: string | null } | null;
  music_release_countries?: Array<{ country_id: string }> | null;
}

export interface MusicTrack {
  id: string;
  release_id: string;
  position: number;
  title: string;
  featuring?: string | null;
  duration_seconds?: number | null;
  has_preview?: boolean | null;
  audio_status?: string | null;
  is_free?: boolean | null;
  explicit?: boolean | null;
  music_releases?: MusicRelease | null;
  /** Côté compte, jamais en base du titre : ajouté en favori ou à la playlist, ou dernière écoute (ISO). */
  added_at?: string | null;
}

/** Nom affiché : l'artiste du compte, sinon le nom saisi, sinon « Rivendy ». */
export function artistName(r: Pick<MusicRelease, "artist_name" | "play_artists"> | null | undefined): string {
  return r?.play_artists?.name?.trim() || r?.artist_name?.trim() || "Rivendy";
}

/** « Artiste · feat. X ». */
export function trackSubtitle(t: Pick<MusicTrack, "featuring">, r: MusicRelease | null | undefined): string {
  const feat = t.featuring?.trim() || r?.featuring?.trim();
  return feat ? `${artistName(r)} · feat. ${feat}` : artistName(r);
}

/** Un titre se lit quand son fichier est prêt. */
export function isPlayable(t: Pick<MusicTrack, "audio_status">): boolean {
  return t.audio_status === "ready";
}

/** Sortie disponible dans un marché : aucune restriction = partout. */
export function availableIn(r: Pick<MusicRelease, "music_release_countries">, market: string | null): boolean {
  const rows = r.music_release_countries ?? [];
  if (rows.length === 0) return true;
  return !!market && rows.some((c) => c.country_id === market);
}

/** Libellé de la sortie (single, EP, album…). */
export function releaseKindLabel(kind: string | null | undefined): string {
  switch (kind) {
    case "single": return "Single";
    case "ep": return "EP";
    case "album": return "Album";
    case "mixtape": return "Mixtape";
    case "compilation": return "Compilation";
    default: return kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : "";
  }
}

/** 3:07 ; 1:02:05. */
export function formatDuration(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(Number(seconds ?? 0)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(r).padStart(2, "0")}`;
}

/** « 12 titres · 41 min ». */
export function releaseMeta(tracks: Array<Pick<MusicTrack, "duration_seconds">>): string {
  const total = tracks.reduce((s, t) => s + Number(t.duration_seconds ?? 0), 0);
  const n = tracks.length;
  const minutes = Math.round(total / 60);
  return `${n} titre${n > 1 ? "s" : ""}${minutes > 0 ? ` · ${minutes} min` : ""}`;
}

const THUMB_BUCKETS = new Set(["music-images", "play-images"]);

/**
 * Vignette Supabase Storage (même règle que l'app) : seulement pour les
 * buckets music-images et play-images, en https. Sinon l'URL d'origine.
 * `resize=contain` : avec la seule largeur et le mode par défaut (cover),
 * Supabase garde la hauteur d'origine et RECADRE — une pochette carrée de
 * 1329 px revenait en 320×1329 et s'affichait zoomée sur son centre
 * (constaté en production le 2026-10-22).
 */
export function thumbUrl(url: string | null | undefined, width: 160 | 320 | 480 | 720): string | null {
  if (!url || !url.startsWith("https://")) return url ?? null;
  const m = url.match(/^(https:\/\/[^/]+)\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!m || !THUMB_BUCKETS.has(m[2])) return url;
  const path = m[3].split("?")[0];
  return `${m[1]}/storage/v1/render/image/public/${m[2]}/${path}?width=${width}&resize=contain&quality=70`;
}

/** Mouvement dans le Rivendy Hit : « Nouveau », « ▲ 3 », « ▼ 2 », « = ». */
export function hitMovement(rank: number, previousRank: number | null | undefined): string {
  if (previousRank == null) return "Nouveau";
  if (previousRank > rank) return `▲ ${previousRank - rank}`;
  if (previousRank < rank) return `▼ ${rank - previousRank}`;
  return "=";
}

// ── Comptage : mêmes règles que l'app ──────────────────────────────────────

/** Secondes d'écoute réelle avant de compter : 30, ou toute la durée d'un titre plus court. */
export function countThreshold(durationSeconds: number | null | undefined): number {
  const d = Number(durationSeconds ?? 0);
  return d > 0 && d < 30 ? d : 30;
}

/**
 * Le temps d'écoute ne grandit que pendant la lecture, et par pas de 2 s au
 * plus : un saut dans le titre ne compte pas.
 */
export function addListened(listened: number, previousPosition: number, position: number): number {
  const delta = position - previousPosition;
  return delta > 0 && delta <= 2 ? listened + delta : listened;
}

/** Faut-il compter maintenant ? Jamais un extrait, jamais deux fois. */
export function shouldCount(p: { listened: number; duration: number | null | undefined; preview: boolean; counted: boolean }): boolean {
  if (p.preview || p.counted) return false;
  return p.listened >= countThreshold(p.duration);
}

/** Lien du titre suivant demandé à 70 % du titre, ou 20 s avant la fin. */
export function shouldPrefetchNext(position: number, duration: number | null | undefined): boolean {
  const d = Number(duration ?? 0);
  if (!(d > 0)) return false;
  return position >= 0.7 * d || d - position <= 20;
}

/** Un lien signé se réutilise 10 min au plus, s'il reste valable 2 min. */
export function grantStillUsable(fetchedAt: number, expiresAt: number, now: number): boolean {
  return now - fetchedAt <= 10 * 60_000 && expiresAt - now >= 2 * 60_000;
}

/** Codes après lesquels la file passe au titre suivant au lieu de s'arrêter. */
export const SKIPPABLE_STREAM_ERRORS = new Set(["not_in_territory", "not_found", "no_audio", "pass_required"]);

/** Messages du site pour `musique-stream-url` (le site peut parler de Rivendy+). */
export function streamErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case "not_authenticated": return "Connectez-vous pour écouter.";
    case "too_many_requests": return "Trop de demandes d’écoute : patientez quelques minutes.";
    case "pass_required": return "Titre réservé aux abonnés Rivendy+.";
    case "not_in_territory": return "Ce titre n’est pas disponible dans votre pays.";
    case "no_market": return "Votre compte n’a pas de pays enregistré : complétez votre profil.";
    case "not_found": return "Ce titre n’est plus disponible.";
    case "no_audio": return "Ce titre n’est pas encore prêt.";
    case "too_many_streams": return "Rivendy+ est déjà écouté ou regardé sur deux écrans.";
    default: return "La lecture n’a pas pu démarrer. Réessayez.";
  }
}

// ── File d'attente ─────────────────────────────────────────────────────────

export type RepeatMode = "off" | "all" | "one";

/** Mode de répétition suivant : désactivé → toute la file → ce titre. */
export function nextRepeat(mode: RepeatMode): RepeatMode {
  return mode === "off" ? "all" : mode === "all" ? "one" : "off";
}

/** Index suivant, ou null à la fin de la file (répétition « toute la file » : retour au début). */
export function nextIndex(index: number, length: number, repeat: RepeatMode): number | null {
  if (length === 0) return null;
  if (repeat === "one") return index;
  if (index + 1 < length) return index + 1;
  return repeat === "all" ? 0 : null;
}

/** « Précédent » : après 3 s de lecture, on reprend le titre au début. */
export function previousAction(index: number, position: number): { restart: boolean; index: number } {
  if (position > 3 || index === 0) return { restart: true, index };
  return { restart: false, index: index - 1 };
}

/**
 * Aléatoire : le titre en cours reste premier, le reste est mélangé.
 * [random] injectable pour les essais.
 */
export function shuffleKeepingCurrent<T>(items: T[], current: number, random: () => number = Math.random): T[] {
  if (items.length === 0) return [];
  const head = items[current];
  const rest = items.filter((_, i) => i !== current);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [head, ...rest];
}

/** Nom de playlist : 1 à 60 caractères. */
export function isValidPlaylistName(name: string): boolean {
  const n = name.trim();
  return n.length >= 1 && n.length <= 60;
}

/** Recherche : à partir de 2 caractères. */
export function searchable(query: string): boolean {
  return query.trim().length >= 2;
}

// ── Découverte (refonte du 2026-10-22) ─────────────────────────────────────

export type GenreRef = { id: string; name: string; position?: number | null };

/**
 * Filtres de genre : seulement les genres qui ont au moins une sortie dans
 * ce qui est affiché (jamais une puce qui ne donne rien), dans l'ordre du
 * dashboard.
 */
export function availableGenres<G extends GenreRef>(
  releases: Array<Pick<MusicRelease, "genre_id">>, genres: G[],
): G[] {
  const used = new Set(releases.map((r) => r.genre_id).filter((g): g is string => !!g));
  return genres
    .filter((g) => used.has(g.id))
    .sort((a, b) => (a.position ?? 100) - (b.position ?? 100) || a.name.localeCompare(b.name, "fr"));
}

/** Sorties d'un genre ; `null` = toutes. */
export function filterByGenre<R extends Pick<MusicRelease, "genre_id">>(releases: R[], genre: string | null): R[] {
  return genre ? releases.filter((r) => r.genre_id === genre) : releases;
}

/** Artistes des sorties, sans doublon, dans l'ordre d'apparition. */
export function distinctArtistIds(releases: Array<Pick<MusicRelease, "artist_id">>): string[] {
  const seen = new Set<string>();
  for (const r of releases) if (r.artist_id) seen.add(r.artist_id);
  return [...seen];
}

/** Sorties sans doublon (la sélection et les nouveautés se recouvrent). */
export function uniqueReleases<R extends Pick<MusicRelease, "id">>(lists: R[][]): R[] {
  const seen = new Set<string>();
  const out: R[] = [];
  for (const list of lists) for (const r of list) if (!seen.has(r.id)) { seen.add(r.id); out.push(r); }
  return out;
}

/** Année d'une sortie (date de sortie, sinon de publication). */
export function releaseYear(r: Pick<MusicRelease, "release_date" | "published_at">): string {
  return r.release_date?.slice(0, 4) || r.published_at?.slice(0, 4) || "";
}

/** Chemin public partagé (les pages de titre renvoient vers leur sortie). */
export function musicSharePath(kind: "track" | "release" | "artist" | "playlist", id: string): string {
  switch (kind) {
    case "track": return `/music/track/${id}`;
    case "release": return `/music/album/${id}`;
    case "artist": return `/artist/${id}`;
    case "playlist": return `/music/playlist/${id}`;
  }
}

/**
 * Action demandée sans compte (aimer, enregistrer, suivre, ranger, écouter),
 * gardée le temps de la connexion puis reprise sur la même page. Une action
 * périmée (30 min) ou mal formée est ignorée.
 */
export type PendingMusicAction = {
  kind: "like" | "save" | "follow" | "playlist" | "play";
  id: string;
  path: string;
  label: string;
  at: number;
};

const PENDING_KINDS = new Set<PendingMusicAction["kind"]>(["like", "save", "follow", "playlist", "play"]);
export const PENDING_MAX_AGE_MS = 30 * 60_000;

export function parsePendingAction(raw: string | null, now: number): PendingMusicAction | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<PendingMusicAction>;
    if (!v || typeof v !== "object") return null;
    if (!v.kind || !PENDING_KINDS.has(v.kind)) return null;
    if (typeof v.id !== "string" || !v.id || typeof v.path !== "string" || !v.path.startsWith("/")) return null;
    if (v.path.startsWith("//")) return null;
    if (typeof v.at !== "number" || now - v.at > PENDING_MAX_AGE_MS || v.at > now + 60_000) return null;
    return { kind: v.kind, id: v.id, path: v.path, label: typeof v.label === "string" ? v.label.slice(0, 120) : "", at: v.at };
  } catch {
    return null;
  }
}

/** La page de retour est-elle celle de l'action (sans la requête) ? */
export function samePath(a: string, b: string): boolean {
  const clean = (p: string) => (p.split("?")[0].replace(/\/+$/, "") || "/");
  return clean(a) === clean(b);
}

// ── Finitions du 2026-10-22 (lecteur, composition de l'accueil) ───────────

/**
 * Durée affichée par le lecteur. Celle du fichier dès qu'il est chargé ;
 * avant, la durée VÉRIFIÉE du titre en base (une file reprise après un
 * rechargement n'a encore rien chargé : elle affichait « 0:00 / 0:00 »).
 * `null` = inconnue (chargement en cours, ou titre sans durée enregistrée).
 */
export function playerDuration(p: { ready: boolean; mediaDuration: number; trackDuration: number | null | undefined }): number | null {
  if (p.ready && Number.isFinite(p.mediaDuration) && p.mediaDuration > 0) return p.mediaDuration;
  const t = Number(p.trackDuration ?? 0);
  return Number.isFinite(t) && t > 0 ? t : null;
}

/** « 3:29 », ou « –:–– » quand la durée n'est pas (encore) connue. */
export function formatPlayerTime(seconds: number | null): string {
  return seconds === null ? "–:––" : formatDuration(seconds);
}

/**
 * Sélection et nouveautés : quand les nouveautés n'ajoutent presque rien à
 * la sélection (moins de 3 sorties à elles), UNE seule rangée regroupée —
 * jamais les mêmes cartes deux fois de suite. Sinon deux rangées, les
 * nouveautés sans les sorties déjà dans la sélection.
 */
export type HomeShelves<R> =
  | { mode: "one"; title: string; releases: R[] }
  | { mode: "two"; selection: R[]; news: R[] };

export function homeShelves<R extends Pick<MusicRelease, "id">>(featured: R[], fresh: R[]): HomeShelves<R> {
  if (featured.length === 0) return { mode: "one", title: "Nouveautés", releases: fresh };
  const inSelection = new Set(featured.map((r) => r.id));
  const news = fresh.filter((r) => !inSelection.has(r.id));
  if (news.length < 3) {
    return { mode: "one", title: news.length > 0 ? "La sélection et les nouveautés" : "La sélection Rivendy", releases: uniqueReleases([featured, news]) };
  }
  return { mode: "two", selection: featured, news };
}

/**
 * « Écoutés récemment » sur l'accueil : seulement s'il apporte quelque
 * chose — au moins deux titres de sorties qui ne sont pas déjà affichées.
 * L'historique complet reste dans la bibliothèque.
 */
export function recentIsUseful(recentReleaseIds: string[], shownReleaseIds: Set<string>): boolean {
  return new Set(recentReleaseIds.filter((id) => !shownReleaseIds.has(id))).size >= 2;
}

/**
 * Mention du Rivendy Hit dans la bannière : « N° 1 » seulement si le titre
 * est VRAIMENT premier de la dernière semaine ; collée à la sortie mise en
 * avant si c'est la même, sinon une carte à part.
 */
export function heroHitBadge(top: { rank: number; releaseId: string | null } | null, spotlightId: string):
  | { kind: "none" } | { kind: "same" } | { kind: "other" } {
  if (!top || top.rank !== 1 || !top.releaseId) return { kind: "none" };
  return top.releaseId === spotlightId ? { kind: "same" } : { kind: "other" };
}

// ── Mise en page « application » du 2026-10-22 (bibliothèque, panneaux) ────

export type LibraryKind = "liked" | "playlist" | "album" | "artist";

/** Une entrée de « Ma bibliothèque » : uniquement des données du compte. */
export type LibraryEntry = {
  key: string;
  kind: LibraryKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  cover: string | null;
  /** Pochettes d'une playlist (mosaïque), dans l'ordre des titres. */
  covers?: string[];
  /** Ajouté (enregistré, suivi, créé) — ISO. */
  addedAt: string | null;
  /** Dernière utilisation connue (écoute, modification) — ISO. */
  usedAt: string | null;
  /** « Titres likés » reste en tête, comme une playlist épinglée. */
  pinned?: boolean;
};

export type LibrarySort = "recent" | "added" | "alpha";

const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) || 0 : 0);

/** La plus récente de plusieurs dates ISO (null si aucune). */
export function latestIso(...isos: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  for (const d of isos) if (d && (!best || time(d) > time(best))) best = d;
  return best;
}

/** Tri de la bibliothèque : l'entrée épinglée d'abord, puis le critère choisi. */
export function sortLibrary(entries: LibraryEntry[], sort: LibrarySort): LibraryEntry[] {
  const by = (a: LibraryEntry, b: LibraryEntry) => {
    if (sort === "alpha") return a.title.localeCompare(b.title, "fr", { sensitivity: "base" });
    if (sort === "added") return time(b.addedAt) - time(a.addedAt) || a.title.localeCompare(b.title, "fr");
    return time(latestIso(b.usedAt, b.addedAt)) - time(latestIso(a.usedAt, a.addedAt)) || a.title.localeCompare(b.title, "fr");
  };
  return [...entries].sort((a, b) => (!!a.pinned === !!b.pinned ? by(a, b) : a.pinned ? -1 : 1));
}

/** Filtre (type + texte, sans accents). Le filtre « Playlists » garde « Titres likés ». */
export function filterLibrary(entries: LibraryEntry[], kind: LibraryKind | null, query: string): LibraryEntry[] {
  const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  const q = fold(query);
  return entries.filter((e) => {
    if (kind && !(e.kind === kind || (kind === "playlist" && e.kind === "liked"))) return false;
    return !q || fold(e.title).includes(q) || fold(e.subtitle).includes(q);
  });
}

/** Filtres proposés : seulement les types présents dans la bibliothèque. */
export function libraryKinds(entries: LibraryEntry[]): Array<"playlist" | "album" | "artist"> {
  const has = (k: LibraryKind) => entries.some((e) => e.kind === k);
  const out: Array<"playlist" | "album" | "artist"> = [];
  if (has("playlist") || has("liked")) out.push("playlist");
  if (has("album")) out.push("album");
  if (has("artist")) out.push("artist");
  return out;
}

/** Durée totale d'une liste : « 3 min 29 s », « 2 h 05 min », « plus de 24 h ». */
export function totalDurationLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s >= 24 * 3600) return "plus de 24 h";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m > 0) return r > 0 ? `${m} min ${String(r).padStart(2, "0")} s` : `${m} min`;
  return `${r} s`;
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** Date d'ajout : « aujourd’hui », « hier », « il y a 5 jours », puis « 14 févr. 2026 ». */
export function addedAtLabel(iso: string | null | undefined, now: number): string {
  const t = time(iso);
  if (!t) return "";
  const startOf = (x: number) => { const d = new Date(x); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const days = Math.round((startOf(now) - startOf(t)) / 86_400_000);
  if (days <= 0) return "aujourd’hui";
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} jours`;
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Largeur d'un panneau gardée dans ses bornes (bibliothèque, panneau de lecture). */
export function clampPanel(width: number, min: number, max: number): number {
  if (!Number.isFinite(width)) return min;
  return Math.min(max, Math.max(min, Math.round(width)));
}

/**
 * Largeurs réellement affichées : le panneau central garde au moins
 * `centerMin` ; on réduit d'abord le panneau de droite, puis la bibliothèque.
 */
export function fitPanels(p: { available: number; left: number; right: number; leftMin: number; rightMin: number; centerMin: number }):
  { left: number; right: number } {
  let { left, right } = p;
  let over = left + right + p.centerMin - p.available;
  if (over > 0) { const r = Math.max(0, Math.min(over, right - p.rightMin)); right -= r; over -= r; }
  if (over > 0) { const l = Math.max(0, Math.min(over, left - p.leftMin)); left -= l; }
  return { left, right };
}

/**
 * Teinte d'en-tête tirée d'une pochette : assombrie jusqu'à ce que le texte
 * blanc reste lisible (contraste 4,5:1 au moins). Entrée et sortie en [r, g, b].
 */
export function headerTint(rgb: [number, number, number]): [number, number, number] {
  const f = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (c: number[]) => 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  let c = rgb.map((x) => Math.max(0, Math.min(255, Math.round(x)))) as [number, number, number];
  for (let k = 0; k < 20 && 1.05 / (lum(c) + 0.05) < 4.5; k++) c = c.map((x) => Math.round(x * 0.85)) as [number, number, number];
  return c;
}

// ── Lot « Musique web » (2026-10-23) ───────────────────────────────────────

/** Ce que l'accueil montre déjà en entier : titres du Hit, sorties, artistes. */
export const HOME_SHOWS = { hit: 5, releases: 12, artists: 12 } as const;

export type HomeRubric = "hit" | "explore" | "artists" | "clips";

/**
 * Raccourcis de rubrique qui apportent quelque chose : tant que l'accueil
 * montre déjà tout le catalogue, un raccourci vers une page qui le répète,
 * ou vers une page vide (aucun clip), est retiré.
 */
export function usefulRubrics(c: { hitTracks: number; releases: number; artists: number; clips: number }): HomeRubric[] {
  const out: HomeRubric[] = [];
  if (c.hitTracks > HOME_SHOWS.hit) out.push("hit");
  if (c.releases > HOME_SHOWS.releases) out.push("explore");
  if (c.artists > HOME_SHOWS.artists) out.push("artists");
  if (c.clips > 0) out.push("clips");
  return out;
}

// ── Refonte de l'accueil (2026-10-28, maquette « Monte le son. ») ─────────

/**
 * Pochettes d'une rangée de l'accueil : 2 × 2 sur téléphone, une rangée de 4
 * sur grand panneau ; au-delà, « Tout voir ».
 */
export const HOME_GRID = 4;

/**
 * Bannière « À la une » : la première sortie de la sélection (ordre du
 * dashboard), sinon la plus récente — jamais une sortie inventée. Elle sort
 * des rangées qui suivent : on ne la voit pas deux fois.
 */
export function homeSpotlight<R extends Pick<MusicRelease, "id">>(featured: R[], fresh: R[]):
  { release: R | null; source: "featured" | "latest" | null; featured: R[]; fresh: R[] } {
  const release = featured[0] ?? fresh[0] ?? null;
  if (!release) return { release: null, source: null, featured, fresh };
  const other = (r: R) => r.id !== release.id;
  return { release, source: featured[0] ? "featured" : "latest", featured: featured.filter(other), fresh: fresh.filter(other) };
}

export type InstallHint = "ios" | "android" | null;
/** « Plus tard » : l'invitation se tait 30 jours. */
export const INSTALL_HINT_SNOOZE_MS = 30 * 24 * 3_600_000;

/**
 * Téléphone : comment garder Rivendy Musique sous la main. iPhone (aucune
 * appli iOS) : « Sur l'écran d'accueil » ; Android : l'appli Rivendy. Rien
 * dans le navigateur intégré d'une appli, une fois installée, ni pendant
 * 30 jours après « Plus tard ».
 */
export function installHint(p: { ua: string; standalone: boolean; touchPoints: number; dismissedAt: number | null; now: number }): InstallHint {
  if (p.standalone) return null;
  if (p.dismissedAt !== null && p.now - p.dismissedAt < INSTALL_HINT_SNOOZE_MS) return null;
  if (/FBAN|FBAV|FB_IAB|Instagram|Snapchat|TikTok|Line\/|; wv\)/i.test(p.ua)) return null;
  if (/iPhone|iPod|iPad/.test(p.ua) || (/Macintosh/.test(p.ua) && p.touchPoints > 1)) return "ios";
  if (/Android/.test(p.ua)) return "android";
  return null;
}
