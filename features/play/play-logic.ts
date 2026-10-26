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

/**
 * Classification telle qu'ENREGISTRÉE pour le titre (`age_rating` : 'tous',
 * '10', '12', '16' ou '18', choisie au dashboard). Une valeur absente ou
 * inconnue ne s'affiche pas — on n'invente jamais « Tout public ».
 */
export function ageLabel(a: string | null | undefined): string | null {
  switch (a) {
    case "tous": return "Tout public";
    case "10": return "-10";
    case "12": return "-12";
    case "16": return "-16";
    case "18": return "-18";
    default: return null;
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

// ── Refonte « salle de cinéma » (2026-10-22) ───────────────────────────────

const https = (u: string | null | undefined): string | null => (u && u.startsWith("https://") ? u : null);
const PLAY_IMAGE = /^(https:\/\/[^/]+)\/storage\/v1\/object\/public\/play-images\/([^?#]+)$/;

/**
 * Image du catalogue (bucket play-images) redimensionnée par Supabase, aux
 * proportions d'origine. `resize=contain` est INDISPENSABLE : avec un seul
 * côté et le mode par défaut (cover), Supabase garde la hauteur d'origine et
 * RECADRE — 480 de large donnait 480×2048 pour une affiche de 1365×2048
 * (constaté le 2026-10-22). Toute autre adresse est rendue telle quelle.
 */
export function playImage(url: string | null | undefined, width: number): string | null {
  const u = https(url);
  if (!u) return null;
  const m = PLAY_IMAGE.exec(u);
  if (!m) return u;
  return `${m[1]}/storage/v1/render/image/public/play-images/${m[2]}?width=${Math.round(width)}&resize=contain&quality=70`;
}

/** `srcset` d'une image du catalogue ; undefined si l'adresse ne se redimensionne pas. */
export function playSrcSet(url: string | null | undefined, widths: readonly number[]): string | undefined {
  const u = https(url);
  if (!u || !PLAY_IMAGE.test(u)) return undefined;
  return widths.map((w) => `${playImage(u, w)} ${w}w`).join(", ");
}

/**
 * Image paysage RÉELLE : le fond 16:9 posé au dashboard ; pour un clip, sa
 * vignette publique. Jamais une affiche recadrée, jamais la vignette d'un
 * film ou d'un épisode (vidéo signée : l'image demande un jeton).
 */
export function landscapeArt(t: Pick<PlayTitle, "kind" | "backdrop_url" | "thumbnail_url">): string | null {
  return https(t.backdrop_url) ?? (kindOf(t.kind) === "clip" ? https(t.thumbnail_url) : null);
}

/** Affiche portrait 2:3. */
export const posterArt = (t: Pick<PlayTitle, "poster_url">): string | null => https(t.poster_url);

const newestFirst = (a: Pick<PlayTitle, "published_at">, b: Pick<PlayTitle, "published_at">) =>
  (b.published_at ?? "").localeCompare(a.published_at ?? "");
const featuredRank = (t: Pick<PlayTitle, "featured_rank">) =>
  t.featured_rank == null ? Number.POSITIVE_INFINITY : Number(t.featured_rank);

/** Mis à la une au dashboard d'abord (rang), puis du plus récent au plus ancien. */
export function byFeaturedThenNewest(a: PlayTitle, b: PlayTitle): number {
  const fa = featuredRank(a);
  const fb = featuredRank(b);
  if (fa !== fb) return fa < fb ? -1 : 1;
  return newestFirst(a, b);
}

/** Publié depuis moins de `days` jours. */
export function isRecent(t: Pick<PlayTitle, "published_at">, now: Date, days = 60): boolean {
  if (!t.published_at) return false;
  const at = Date.parse(t.published_at);
  return Number.isFinite(at) && now.getTime() - at <= days * 86_400_000;
}

/**
 * Bannière d'accueil : films et séries regardables qui ont une VRAIE image
 * (fond ou affiche) — jamais un titre sans visuel. Une seule diapositive tant
 * qu'un seul titre s'y prête : la sélection n'apparaît qu'à partir de deux.
 */
export function heroTitles(catalog: PlayTitle[], max = 5): PlayTitle[] {
  return catalog
    .filter((t) => isListable(t) && kindOf(t.kind) !== "clip" && !!(landscapeArt(t) || posterArt(t)))
    .sort(byFeaturedThenNewest)
    .slice(0, max);
}

/** Bandeau au-dessus du titre de la bannière : la raison de sa présence, rien d'inventé. */
export function heroKicker(t: PlayTitle, now: Date): string {
  const k = kindOf(t.kind);
  if (t.featured_rank != null) return k === "serie" ? "La série à la une" : k === "clip" ? "Le clip à la une" : "Le film à la une";
  if (isRecent(t, now)) return k === "serie" ? "Nouvelle série" : k === "clip" ? "Nouveau clip" : "Nouveau film";
  return kindLabel(k);
}

/** « 2023 · Film · Action · 14 min » : seulement ce qui est renseigné. */
export function metaParts(t: PlayTitle, episodes?: number): string[] {
  const k = kindOf(t.kind);
  const parts: string[] = [];
  if (t.release_year) parts.push(String(t.release_year));
  parts.push(kindLabel(k));
  if (t.genre?.trim()) parts.push(t.genre.trim());
  if (k === "serie") {
    if (episodes) parts.push(`${episodes} épisode${episodes > 1 ? "s" : ""}`);
  } else {
    const d = durationLabel(t.duration_seconds);
    if (d) parts.push(d);
  }
  return parts;
}

/**
 * Lecture directe d'un film ou d'un clip (une série passe par un épisode).
 * Un clip se lit sur son propre écran (refonte Clips du 2026-10-26).
 */
export function watchHref(t: Pick<PlayTitle, "id" | "kind">): string | null {
  const k = kindOf(t.kind);
  if (k === "film") return `/play/watch/movie/${t.id}`;
  if (k === "clip") return `/play/clip/${t.id}`;
  return null;
}

/** Reprise d'une position enregistrée : l'épisode, sinon le film. */
export function resumeHref(p: Pick<WatchProgress, "title_id" | "episode_id">): string {
  return p.episode_id ? `/play/watch/episode/${p.episode_id}` : `/play/watch/movie/${p.title_id}`;
}

/**
 * « Continuer à regarder » : une VRAIE progression seulement (au moins 30 s,
 * pas finie), une entrée par titre, la plus récente d'abord.
 */
export function resumeEntries(progress: WatchProgress[]): WatchProgress[] {
  const seen = new Set<string>();
  return [...progress]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .filter((p) => {
      if (seen.has(p.title_id)) return false;
      seen.add(p.title_id);
      return p.position_seconds >= 30 && !isFinished(p.position_seconds, p.duration_seconds);
    });
}

/** « Reste 12 min ». */
export function remainingLabel(position: number, duration: number): string {
  const left = durationLabel(Math.max(0, duration - position));
  return left ? `Reste ${left}` : "Presque fini";
}

/** Compteur d'une rangée : « 03 », « 12 ». */
export const countLabel = (n: number) => String(Math.max(0, n)).padStart(2, "0");

export type HomeRowLayout = "landscape" | "poster" | "ranked";
export interface HomeRow {
  id: string;
  title: string;
  titles: PlayTitle[];
  layout: HomeRowLayout;
  /** Page complète de la rubrique. */
  href?: string;
  /** Nombre de titres de la rubrique entière, quand la rangée n'en montre qu'une partie. */
  total?: number;
}

/** En dessous : une seule rangée « À l'affiche », jamais les mêmes titres répétés. */
export const SMALL_CATALOG = 8;

/**
 * Rangées de découverte de l'accueil (films et séries ; les clips ont leur
 * rangée à part). Chaque titre n'apparaît qu'UNE fois : avant le 2026-10-22,
 * les trois mêmes titres revenaient sous « Top 10 », « Nouveautés »,
 * « Films » et « Séries ». Rangée vide = absente.
 */
export function homeRows(catalog: PlayTitle[], topIds: string[], now: Date): HomeRow[] {
  const list = catalog.filter((t) => isListable(t) && kindOf(t.kind) !== "clip");
  if (list.length === 0) return [];
  const topRank = new Map(topIds.map((id, i) => [id, i]));
  if (list.length <= SMALL_CATALOG) {
    // À la une d'abord, puis les plus regardés de la semaine, puis les plus récents.
    const ordered = [...list].sort((a, b) => {
      const fa = featuredRank(a);
      const fb = featuredRank(b);
      if (fa !== fb) return fa < fb ? -1 : 1;
      return (topRank.get(a.id) ?? 99) - (topRank.get(b.id) ?? 99) || newestFirst(a, b);
    });
    return [{ id: "affiche", title: "À l’affiche", titles: ordered, layout: "landscape" }];
  }

  const used = new Set<string>();
  const rows: HomeRow[] = [];
  const free = (ts: PlayTitle[]) => ts.filter((t) => !used.has(t.id));
  const push = (row: HomeRow) => {
    rows.push(row);
    row.titles.forEach((t) => used.add(t.id));
  };

  const byId = new Map(list.map((t) => [t.id, t]));
  const top = topIds.map((id) => byId.get(id)).filter((t): t is PlayTitle => !!t).slice(0, 10);
  if (top.length >= 3) push({ id: "top", title: "Les plus regardés cette semaine", titles: top, layout: "ranked" });

  const recent = free([...list].sort(newestFirst)).filter((t) => isRecent(t, now)).slice(0, 20);
  if (recent.length >= 3) push({ id: "new", title: "Nouveautés", titles: recent, layout: "landscape" });

  const byGenre = new Map<string, PlayTitle[]>();
  for (const t of free(list)) {
    const g = t.genre?.trim();
    if (!g || isDocumentary(g)) continue;
    byGenre.set(g, [...(byGenre.get(g) ?? []), t]);
  }
  [...byGenre.entries()]
    .filter(([, ts]) => ts.length >= 4)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "fr"))
    .slice(0, 3)
    .forEach(([g, ts]) => push({ id: `genre:${g}`, title: g, titles: [...ts].sort(newestFirst).slice(0, 20), layout: "landscape" }));

  const docs = free(list).filter((t) => isDocumentary(t.genre)).sort(newestFirst);
  if (docs.length >= 3) push({ id: "docs", title: "Documentaires", titles: docs.slice(0, 20), layout: "landscape" });

  for (const [kind, title, href] of [["film", "Films", "/play/movies"], ["serie", "Séries", "/play/series"]] as const) {
    const all = list.filter((t) => kindOf(t.kind) === kind);
    const rest = free(all).sort(newestFirst).slice(0, 20);
    if (rest.length) push({ id: kind, title, titles: rest, layout: "poster", href, total: all.length });
  }
  return rows;
}

/** Texte comparable : minuscules, sans accents (œ → oe, æ → ae). Miroir de `_fold` de l'app. */
export function foldText(s: string): string {
  return s
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[’‘`]/g, "'")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Recherche Play, miroir de `searchTitles` de l'app : titre, genre ou
 * artiste, avec ou sans accents ni majuscules ; titres regardables seulement.
 * Requête vide : tout, du plus récent au plus ancien.
 */
export function searchTitles(titles: PlayTitle[], query: string): PlayTitle[] {
  const q = foldText(query.trim());
  const listable = titles.filter(isListable).sort(newestFirst);
  if (!q) return listable;
  return listable.filter((t) => foldText(t.title).includes(q) || foldText(t.genre ?? "").includes(q) || foldText(t.artist ?? "").includes(q));
}

/** Genres présents dans une liste, dans l'ordre alphabétique (puces de filtre). */
export function genresOf(titles: Array<Pick<PlayTitle, "genre">>): string[] {
  const seen = new Map<string, string>();
  for (const t of titles) {
    const g = t.genre?.trim();
    if (g && !seen.has(foldText(g))) seen.set(foldText(g), g);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "fr"));
}

// ── Coque « application » (2026-10-23) ─────────────────────────────────────

/** Rubrique rappelée dans la barre du haut, d'après l'adresse. */
export function sectionLabel(pathname: string | null | undefined): string {
  const p = pathname || "/play";
  if (p === "/play") return "Découvrir";
  if (p.startsWith("/play/movie")) return "Films";
  if (p.startsWith("/play/series") || p.startsWith("/play/episode")) return "Séries";
  if (p.startsWith("/play/clip")) return "Clips";
  if (p.startsWith("/play/my-list")) return "Ma liste";
  if (p.startsWith("/play/history")) return "Récents";
  if (p.startsWith("/play/search")) return "Recherche";
  if (p.startsWith("/play/watch")) return "Lecture";
  if (p.startsWith("/play/short")) return "Short";
  return "Rivendy Play";
}

/** Pastille de la bannière : la raison RÉELLE de la présence du titre (mis à la une, nouveau, sinon son type). */
export function heroBadge(t: PlayTitle, now: Date): string {
  const k = kindOf(t.kind);
  if (t.featured_rank != null) return "À la une";
  if (isRecent(t, now)) return k === "serie" ? "Nouvelle série" : k === "clip" ? "Nouveau clip" : "Nouveau film";
  return kindLabel(k);
}

/** Au-dessus du titre d'une vignette : « Film · Action », « Série · Drame », « Clip · l'artiste ». */
export function tileKicker(t: PlayTitle): string {
  const k = kindOf(t.kind);
  const second = k === "clip" ? t.artist?.trim() : t.genre?.trim();
  return [kindLabel(k), second].filter(Boolean).join(" · ");
}

/** Sous le titre d'une vignette : « 2023 · 14 min » (film, clip), « 2025 · 7 épisodes » (série) — seulement ce qui est renseigné. */
export function tileMeta(t: PlayTitle, episodes?: number): string {
  const k = kindOf(t.kind);
  const parts: string[] = [];
  if (t.release_year) parts.push(String(t.release_year));
  if (k === "serie") {
    if (episodes) parts.push(`${episodes} épisode${episodes > 1 ? "s" : ""}`);
  } else {
    const d = durationLabel(t.duration_seconds);
    if (d) parts.push(d);
  }
  return parts.join(" · ");
}

/** Panneau de droite : « Film · 14 min », « Série · Drame » (la durée d'un film ou d'un clip, sinon le genre). */
export function panelMeta(t: PlayTitle): string {
  const k = kindOf(t.kind);
  const second = (k !== "serie" ? durationLabel(t.duration_seconds) : "") || t.genre?.trim();
  return [kindLabel(k), second].filter(Boolean).join(" · ");
}

export type KindFilter = "all" | "film" | "serie";

/** Filtres utiles d'une sélection : « Tout » et chaque type présent — rien s'il n'y a qu'un type. */
export function kindFilters(titles: Array<Pick<PlayTitle, "kind">>): KindFilter[] {
  const present = (["film", "serie"] as const).filter((k) => titles.some((t) => kindOf(t.kind) === k));
  return present.length > 1 ? ["all", ...present] : [];
}

export function byKindFilter<T extends Pick<PlayTitle, "kind">>(titles: T[], f: KindFilter): T[] {
  return f === "all" ? titles : titles.filter((t) => kindOf(t.kind) === f);
}

/**
 * Suggestions du panneau de droite (quand le compte n'a encore rien dans Ma
 * liste, ou pour un visiteur) : des titres regardables du catalogue, jamais
 * un titre déjà dans la liste — à la une d'abord, puis les plus récents.
 */
export function suggestionsFor(catalog: PlayTitle[], listIds: readonly string[], max = 3): PlayTitle[] {
  const mine = new Set(listIds);
  return catalog
    .filter((t) => isListable(t) && kindOf(t.kind) !== "clip" && !mine.has(t.id))
    .sort(byFeaturedThenNewest)
    .slice(0, max);
}

/** Carte « L'espace des talents » : les clips s'il y en a, sinon les artistes de Rivendy Musique (jamais une rubrique vide). */
export function talentsTarget(clipCount: number): { href: string; label: string } {
  return clipCount > 0
    ? { href: "/play/clips", label: "Explorer les Clips" }
    : { href: "/music/artists", label: "Découvrir les artistes" };
}

/** Initiales du compte (« William Ali » → « WA ») ; « R » à défaut de nom. */
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((w) => Array.from(w)[0] ?? "").join("").toLocaleUpperCase("fr");
  return letters || "R";
}

/** Prénom affiché dans la barre du haut (le premier mot du nom). */
export function firstNameOf(name: string | null | undefined): string | null {
  const w = (name ?? "").trim().split(/\s+/)[0];
  return w ? Array.from(w).slice(0, 18).join("") : null;
}

/** Adresse de la recherche Play pour une saisie (60 caractères au plus). */
export function searchHref(q: string): string {
  const v = q.trim().slice(0, 60);
  return v ? `/play/search?q=${encodeURIComponent(v)}` : "/play/search";
}

// ── « Emerald Cinema » (2026-10-24) ────────────────────────────────────────

export type HeroTitleSize = "xl" | "lg" | "md";

/**
 * Taille du titre de la bannière d'après sa longueur : immense pour un titre
 * court (« Mbayé Trambwé »), plus petite pour un titre long ou écrit en
 * capitales, plus larges (« LA BOUSSOLE DIGITAL Saisons 1 ») — pour qu'il
 * tienne en trois lignes au plus, sans jamais être coupé.
 */
export function heroTitleSize(title: string | null | undefined): HeroTitleSize {
  const t = (title ?? "").trim();
  const letters = Array.from(t.replace(/\s+/g, ""));
  const upper = letters.filter((c) => c !== c.toLocaleLowerCase("fr")).length;
  const weight = letters.length > 0 && upper / letters.length > 0.6 ? 1.3 : 1;
  const length = Array.from(t).length * weight;
  const longest = Math.max(0, ...t.split(/\s+/).map((w) => Array.from(w).length)) * weight;
  if (length <= 16 && longest <= 10) return "xl";
  if (length <= 26 && longest <= 13) return "lg";
  return "md";
}

/**
 * Image de la scène (bannière, fiche, ambiance de la page) : le fond paysage
 * s'il existe — plein cadre —, sinon l'affiche portrait, mise en « key art ».
 */
export function sceneArt(t: Pick<PlayTitle, "kind" | "backdrop_url" | "thumbnail_url" | "poster_url">): { src: string | null; wide: boolean } {
  const wide = landscapeArt(t);
  return wide ? { src: wide, wide: true } : { src: posterArt(t), wide: false };
}

/** Au-dessus du titre d'une carte « Continuer à regarder » : l'épisode en cours, sinon le type. */
export function resumeKicker(
  t: Pick<PlayTitle, "kind">,
  episode: Pick<PlayEpisode, "season" | "episode_number"> | null | undefined,
): string {
  return episode ? `Saison ${episode.season} · Épisode ${episode.episode_number}` : kindLabel(t.kind);
}

// ── « Ma liste » demandée sans compte ──────────────────────────────────────

export interface PendingListAdd { titleId: string; label: string; at: number }

/** Durée de validité d'un ajout demandé avant la connexion. */
export const PENDING_TTL_MS = 30 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ajout à « Ma liste » gardé le temps de la connexion : valide 30 min, un identifiant de titre et un libellé, rien d'autre. */
export function parsePendingListAdd(raw: string | null | undefined, now: number): PendingListAdd | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { titleId?: unknown; label?: unknown; at?: unknown };
    if (typeof v.titleId !== "string" || !UUID.test(v.titleId) || typeof v.at !== "number") return null;
    if (now - v.at > PENDING_TTL_MS || v.at - now > 60_000) return null;
    return { titleId: v.titleId.toLowerCase(), label: typeof v.label === "string" ? v.label.slice(0, 120) : "", at: v.at };
  } catch {
    return null;
  }
}
