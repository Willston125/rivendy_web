/**
 * Rivendy Play sur le site — règles PURES (Omnicanal lot C, 2026-10-22).
 * Miroir de l'app 1.4.9 (`lib/features/play/logic/play_home_logic.dart`,
 * `play_viewing.dart`, `play_quality.dart`, `models/play_models.dart`) : mêmes
 * colonnes, même reprise, même « épisode suivant », même Éco data. Sans import :
 * testé sous Node par `node --test features/play/play-logic.test.mjs`
 * (npm run check:playweb). Les droits et le comptage restent au serveur.
 */

/** Colonnes LUES (jamais `select('*')` : video_uid est fermé aux clients). */
export const TITLE_COLUMNS =
  "id, kind, title, synopsis, genre, release_year, duration_seconds, age_rating, poster_url, backdrop_url, thumbnail_url, video_status, trailer_uid, trailer_status, is_premium, public_video_uid, featured_rank, published_at, artist, artist_id, intro_start_s, intro_end_s, credits_start_s";
export const EPISODE_COLUMNS =
  "id, title_id, season, episode_number, title, synopsis, duration_seconds, thumbnail_url, video_status, is_free_preview, status, intro_start_s, intro_end_s, credits_start_s";

export const STREAM_HOST = "customer-22iqkw4cwdg7uf5h.cloudflarestream.com";

export type TitleKind = "film" | "serie" | "clip" | "short";

export interface PlayTitle {
  id: string;
  kind: TitleKind | string;
  title: string;
  synopsis?: string | null;
  genre?: string | null;
  release_year?: number | null;
  duration_seconds?: number | null;
  age_rating?: string | null;
  poster_url?: string | null;
  backdrop_url?: string | null;
  thumbnail_url?: string | null;
  video_status?: string | null;
  trailer_uid?: string | null;
  trailer_status?: string | null;
  is_premium?: boolean | null;
  public_video_uid?: string | null;
  featured_rank?: number | null;
  published_at?: string | null;
  artist?: string | null;
  artist_id?: string | null;
  intro_start_s?: number | null;
  intro_end_s?: number | null;
  credits_start_s?: number | null;
  play_title_countries?: Array<{ country_id: string }> | null;
}

export interface PlayEpisode {
  id: string;
  title_id: string;
  season: number;
  episode_number: number;
  title: string;
  synopsis?: string | null;
  duration_seconds?: number | null;
  thumbnail_url?: string | null;
  video_status?: string | null;
  is_free_preview?: boolean | null;
  status?: string | null;
  intro_start_s?: number | null;
  intro_end_s?: number | null;
  credits_start_s?: number | null;
}

export interface WatchProgress {
  title_id: string;
  episode_id: string | null;
  position_seconds: number;
  duration_seconds: number;
  updated_at: string;
}

export const kindOf = (k: string | null | undefined): TitleKind =>
  k === "serie" || k === "clip" || k === "short" ? k : "film";

export function kindLabel(k: string | null | undefined): string {
  switch (kindOf(k)) {
    case "serie": return "Série";
    case "clip": return "Clip";
    case "short": return "Short";
    default: return "Film";
  }
}

/** Adresse de la page d'un titre sur le site. */
export function titlePath(t: Pick<PlayTitle, "id" | "kind">): string {
  switch (kindOf(t.kind)) {
    case "serie": return `/play/series/${t.id}`;
    case "clip": return `/play/clip/${t.id}`;
    case "short": return `/play/short/rivendy/${t.id}`;
    default: return `/play/movie/${t.id}`;
  }
}

export const isVideoReady = (t: Pick<PlayTitle, "video_status">) => t.video_status === "ready";
export const hasTrailer = (t: Pick<PlayTitle, "trailer_uid" | "trailer_status">) =>
  !!t.trailer_uid && t.trailer_status === "ready";
export const isArtistClip = (t: Pick<PlayTitle, "kind" | "artist_id">) => kindOf(t.kind) === "clip" && !!t.artist_id;
export const cover = (t: Pick<PlayTitle, "poster_url" | "backdrop_url" | "thumbnail_url">) =>
  t.poster_url || t.backdrop_url || t.thumbnail_url || null;
export const wideImage = (t: Pick<PlayTitle, "poster_url" | "backdrop_url" | "thumbnail_url">) =>
  t.backdrop_url || t.poster_url || t.thumbnail_url || null;

/** Visible dans les rangées : films et clips prêts, séries toujours, jamais les Shorts. */
export function isListable(t: Pick<PlayTitle, "kind" | "video_status">): boolean {
  const k = kindOf(t.kind);
  if (k === "short") return false;
  if (k === "serie") return true;
  return isVideoReady(t);
}

/** Pages de titre : aucun pays = partout ; sinon le marché doit y figurer. */
export function inTerritory(countries: Array<{ country_id: string }> | null | undefined, market: string | null): boolean {
  const rows = countries ?? [];
  if (rows.length === 0) return true;
  return !!market && rows.some((c) => c.country_id === market);
}

export function ageLabel(a: string | null | undefined): string {
  switch (a) {
    case "10": return "-10";
    case "12": return "-12";
    case "16": return "-16";
    case "18": return "-18";
    default: return "Tout public";
  }
}

/** « 1 h 52 », « 45 min ». */
export function durationLabel(seconds: number | null | undefined): string {
  const m = Math.round(Number(seconds ?? 0) / 60);
  if (m <= 0) return "";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}

/** « Série • Drame • 2026 • 1 h 52 » (la durée seulement pour un film ou un clip). */
export function titleMeta(t: PlayTitle, episodes?: number): string {
  const parts: string[] = [];
  const k = kindOf(t.kind);
  if (k !== "film") parts.push(kindLabel(k));
  if (t.genre) parts.push(t.genre);
  if (t.release_year) parts.push(String(t.release_year));
  if (k !== "serie" && t.duration_seconds) parts.push(durationLabel(t.duration_seconds));
  if (k === "serie" && episodes) parts.push(`${episodes} épisode${episodes > 1 ? "s" : ""}`);
  return parts.join(" • ");
}

// ── Reprise ────────────────────────────────────────────────────────────────

/** Fini : 95 % vus, ou moins de clamp(10 % de la durée, 10 s, 120 s) restants. */
export function isFinished(position: number, duration: number): boolean {
  if (!(duration > 0)) return false;
  if (position >= 0.95 * duration) return true;
  const tail = Math.min(120, Math.max(10, 0.1 * duration));
  return duration - position < tail;
}

/** Position de reprise : seulement après 30 s et si ce n'est pas fini. */
export function resumeAt(position: number, duration: number): number {
  return position >= 30 && !isFinished(position, duration) ? Math.floor(position) : 0;
}

export function sortEpisodes(eps: PlayEpisode[]): PlayEpisode[] {
  return [...eps].sort((a, b) => a.season - b.season || a.episode_number - b.episode_number);
}

/** Épisode à proposer pour une série (règle de l'app). */
export function currentEpisode(eps: PlayEpisode[], progress: WatchProgress[]): { episode: PlayEpisode | null; at: number } {
  const ordered = sortEpisodes(eps);
  if (ordered.length === 0) return { episode: null, at: 0 };
  const recent = [...progress].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  for (const p of recent) {
    const i = ordered.findIndex((e) => e.id === p.episode_id);
    if (i < 0) continue;
    if (!isFinished(p.position_seconds, p.duration_seconds)) return { episode: ordered[i], at: resumeAt(p.position_seconds, p.duration_seconds) };
    return { episode: ordered[Math.min(i + 1, ordered.length - 1)], at: 0 };
  }
  return { episode: ordered[0], at: 0 };
}

/** Épisode suivant (jamais un épisode verrouillé). */
export function nextEpisode(eps: PlayEpisode[], currentId: string, unlocked: (e: PlayEpisode) => boolean): PlayEpisode | null {
  const ordered = sortEpisodes(eps).filter((e) => e.video_status === "ready");
  const i = ordered.findIndex((e) => e.id === currentId);
  const next = i >= 0 ? ordered[i + 1] : null;
  return next && unlocked(next) ? next : null;
}

/** « Passer l'intro » visible entre le début (0 par défaut) et la fin de l'intro. */
export function showSkipIntro(s: number, introStart: number | null | undefined, introEnd: number | null | undefined): boolean {
  if (introEnd == null || !(introEnd > 0)) return false;
  return s >= Number(introStart ?? 0) && s < introEnd;
}

/** Moment où « À suivre » apparaît : générique, sinon 10 s avant la fin. */
export function upNextAt(creditsStart: number | null | undefined, duration: number): number {
  return creditsStart != null && creditsStart > 0 ? creditsStart : Math.max(0, duration - 10);
}

// ── Vidéos Cloudflare ──────────────────────────────────────────────────────

export const publicManifest = (uid: string) => `https://${STREAM_HOST}/${uid}/manifest/video.m3u8`;
export const streamThumbnail = (uid: string, height = 480) =>
  `https://${STREAM_HOST}/${uid}/thumbnails/thumbnail.jpg?time=1s&height=${height}`;

/** Qualités (Éco par défaut, comme l'app) : hauteur cible, null = tout le manifeste. */
export const QUALITIES = [
  { id: "eco", label: "Éco (360p)", height: 360 },
  { id: "standard", label: "Standard (480p)", height: 480 },
  { id: "hd", label: "HD auto", height: null },
] as const;
export type QualityId = (typeof QUALITIES)[number]["id"];

export interface Rendition { height: number; bandwidth: number }

/** Lit les variantes du manifeste maître (#EXT-X-STREAM-INF : RESOLUTION, BANDWIDTH). */
export function parseRenditions(master: string): Rendition[] {
  const out: Rendition[] = [];
  for (const line of master.split(/\r?\n/)) {
    if (!line.startsWith("#EXT-X-STREAM-INF:")) continue;
    const bw = /(?:^|[:,])BANDWIDTH=(\d+)/.exec(line);
    const res = /RESOLUTION=(\d+)x(\d+)/.exec(line);
    if (!bw || !res) continue;
    out.push({ height: Math.min(Number(res[1]), Number(res[2])), bandwidth: Number(bw[1]) });
  }
  return out;
}

/** Variante la plus haute sous la hauteur visée, sinon la plus basse. */
export function pickRendition(list: Rendition[], target: number): Rendition | null {
  if (list.length === 0) return null;
  const under = list.filter((r) => r.height <= target).sort((a, b) => b.height - a.height || b.bandwidth - a.bandwidth);
  if (under.length) return under[0];
  return [...list].sort((a, b) => a.height - b.height || a.bandwidth - b.bandwidth)[0];
}

/** Ajoute `clientBandwidthHint` (Mb/s, 6 décimales sans zéros inutiles) en gardant les paramètres. */
export function withBandwidthHint(url: string, bandwidth: number): string {
  const mbps = Number((bandwidth / 1e6).toFixed(6)).toString();
  const u = new URL(url);
  u.searchParams.set("clientBandwidthHint", mbps);
  return u.toString();
}

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/** Messages du site pour `play-playback-token` (le site peut parler de Rivendy+). */
export function playbackErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case "not_authenticated": return "Connectez-vous pour regarder.";
    case "pass_required": return "Réservé aux abonnés Rivendy+.";
    case "not_in_territory": return "Ce titre n’est pas disponible dans votre pays.";
    case "video_not_ready":
    case "no_video": return "Cette vidéo n’est pas encore disponible. Réessayez plus tard.";
    case "not_found":
    case "not_published": return "Ce titre n’est plus disponible.";
    case "personal_token_required": return "Les films et séries Premium arrivent bientôt sur le site. En attendant, regardez-les dans l’application Rivendy.";
    case "too_many_streams": return "Rivendy+ est déjà utilisé sur deux écrans.";
    case "too_many_requests": return "Trop de demandes de lecture : patientez quelques minutes.";
    default: return "Lecture impossible pour le moment. Vérifiez votre connexion et réessayez.";
  }
}

/** Genre « documentaire », sans tenir compte des accents. */
export function isDocumentary(genre: string | null | undefined): boolean {
  const g = (genre ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return g.includes("documentaire") || g.includes("documentary");
}
