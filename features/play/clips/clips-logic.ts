import type { PlayTitle } from "../play-logic";

/**
 * Rivendy Clips sur le site — règles PURES (refonte du 2026-10-26). Sans
 * import à l'exécution (les types seulement) : testé sous Node par
 * `node --test features/play/clips/clips-logic.test.mjs` (npm run check:clips).
 *
 * Rien n'est inventé : un filtre n'apparaît que si le catalogue le remplit,
 * un badge ou un compteur ne s'affiche que s'il repose sur une donnée réelle
 * (date de publication, vues comptées par le serveur, artiste validé).
 */

/** Pages de la section Clips : elles prennent la coque Clips, pas celle des films. */
export function isClipsPath(pathname: string | null | undefined): boolean {
  const p = pathname || "";
  return p === "/play/clips" || p.startsWith("/play/clips/") || p.startsWith("/play/clip/");
}

/** Écran de visionnage d'un clip (lien partagé, carte, suggestion). */
export const clipPath = (id: string): string => `/play/clip/${id}`;

/** Vues et J'aime comptés par le serveur (`play_short_counters`, cible « title »). */
export interface ClipCounts { views: number; likes: number }
export const NO_COUNTS: ClipCounts = { views: 0, likes: 0 };

/** Artiste validé (`play_artists`, lisible seulement s'il est approuvé). */
export interface ClipArtist {
  id: string;
  user_id: string | null;
  name: string;
  genre?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
}

// ── Textes comparables ─────────────────────────────────────────────────────

/**
 * Minuscules, sans accents (œ → oe, æ → ae). MÊME règle que `foldText` de
 * play-logic (vérifié par le test) : « mbaye » retrouve « Mbayé ».
 */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[’‘`]/g, "'")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// ── Nombres et dates ───────────────────────────────────────────────────────

/** « 950 », « 1,2 k », « 12 k », « 3,4 M » — miroir de `compactCount` de l'app. */
export function compactCount(n: number): string {
  const v = Math.floor(Number(n) || 0);
  if (v <= 0) return "0";
  if (v < 1000) return String(v);
  const one = (x: number) => x.toFixed(1).replace(".0", "").replace(".", ",");
  return v < 1_000_000 ? `${one(v / 1000)} k` : `${one(v / 1_000_000)} M`;
}

/** « 12 k vues », « 1 vue » ; vide sans vue comptée (on n'affiche jamais « 0 vue »). */
export function viewsLabel(n: number): string {
  if (!(n > 0)) return "";
  return `${compactCount(n)} vue${n > 1 ? "s" : ""}`;
}

/** « 1 abonné », « 2,4 k abonnés » ; vide à zéro. */
export function followersLabel(n: number): string {
  if (!(n > 0)) return "";
  return `${compactCount(n)} abonné${n > 1 ? "s" : ""}`;
}

/** Durée d'une vignette : « 3:42 », « 1:02:03 » ; vide si inconnue. */
export function clockLabel(seconds: number | null | undefined): string {
  const s = Math.floor(Number(seconds ?? 0));
  if (!(s > 0)) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

const DAY = 86_400_000;

/** « aujourd'hui », « hier », « il y a 3 jours », « il y a 2 semaines », « il y a 5 mois », « il y a 2 ans ». */
export function relativeDate(iso: string | null | undefined, now: Date): string {
  if (!iso) return "";
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  const days = Math.floor((now.getTime() - at) / DAY);
  if (days < 1) return "aujourd’hui";
  if (days < 2) return "hier";
  if (days < 7) return `il y a ${days} jours`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return `il y a ${w} semaine${w > 1 ? "s" : ""}`;
  }
  if (days < 365) return `il y a ${Math.floor(days / 30)} mois`;
  const y = Math.floor(days / 365);
  return `il y a ${y} an${y > 1 ? "s" : ""}`;
}

/** « 12 k vues · il y a 2 jours » : seulement ce qui existe. */
export function clipMeta(views: number, publishedAt: string | null | undefined, now: Date): string {
  return [viewsLabel(views), relativeDate(publishedAt, now)].filter(Boolean).join(" · ");
}

/** Badge « Nouveau » : publié il y a moins de 14 jours (date réelle de publication). */
export const NEW_DAYS = 14;
export function isNewClip(t: Pick<PlayTitle, "published_at">, now: Date, days = NEW_DAYS): boolean {
  if (!t.published_at) return false;
  const at = Date.parse(t.published_at);
  return Number.isFinite(at) && at <= now.getTime() + 60_000 && now.getTime() - at < days * DAY;
}

// ── Filtres de l'accueil ───────────────────────────────────────────────────

export type ClipFilter =
  | { kind: "discover" }
  | { kind: "new" }
  | { kind: "trending" }
  | { kind: "genre"; genre: string };

/** « Nouveautés » : publiés depuis moins de 30 jours. */
export const RECENT_DAYS = 30;
/** « Tendances » n'apparaît qu'avec au moins 3 clips déjà vus : sinon le classement ne dit rien. */
export const TRENDING_MIN = 3;

const newestFirst = (a: Pick<PlayTitle, "published_at">, b: Pick<PlayTitle, "published_at">) =>
  (b.published_at ?? "").localeCompare(a.published_at ?? "");
const rank = (t: Pick<PlayTitle, "featured_rank">) => (t.featured_rank == null ? Number.POSITIVE_INFINITY : Number(t.featured_rank));

/** Mis en avant au dashboard d'abord (rang), puis du plus récent au plus ancien. */
export function discoverOrder(a: PlayTitle, b: PlayTitle): number {
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra < rb ? -1 : 1;
  return newestFirst(a, b);
}

function isRecent(t: Pick<PlayTitle, "published_at">, now: Date, days: number): boolean {
  if (!t.published_at) return false;
  const at = Date.parse(t.published_at);
  return Number.isFinite(at) && now.getTime() - at <= days * DAY;
}

/** Genres présents (un libellé par genre, sans tenir compte des accents), triés. */
export function clipGenres(clips: Array<Pick<PlayTitle, "genre">>): string[] {
  const seen = new Map<string, string>();
  for (const t of clips) {
    const g = t.genre?.trim();
    if (g && !seen.has(fold(g))) seen.set(fold(g), g);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "fr"));
}

export function hasTrending(clips: PlayTitle[], counts: Record<string, ClipCounts>): boolean {
  return clips.filter((t) => (counts[t.id]?.views ?? 0) > 0).length >= TRENDING_MIN;
}

/**
 * Filtres réellement utiles pour CE catalogue : « À découvrir » toujours,
 * « Nouveautés » s'il y a des clips récents, « Tendances » s'il y a assez de
 * vues comptées, puis chaque genre présent — un filtre ne mène jamais à vide.
 */
export function availableFilters(clips: PlayTitle[], counts: Record<string, ClipCounts>, now: Date): ClipFilter[] {
  const out: ClipFilter[] = [{ kind: "discover" }];
  if (clips.some((t) => isRecent(t, now, RECENT_DAYS))) out.push({ kind: "new" });
  if (hasTrending(clips, counts)) out.push({ kind: "trending" });
  for (const g of clipGenres(clips)) out.push({ kind: "genre", genre: g });
  return out;
}

export function filterLabel(f: ClipFilter): string {
  switch (f.kind) {
    case "discover": return "À découvrir";
    case "new": return "Nouveautés";
    case "trending": return "Tendances";
    default: return f.genre;
  }
}

export function sameFilter(a: ClipFilter, b: ClipFilter): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind !== "genre" || fold(a.genre) === fold((b as { genre: string }).genre);
}

/** Les clips d'un filtre, dans l'ordre du filtre. */
export function applyClipFilter(clips: PlayTitle[], f: ClipFilter, counts: Record<string, ClipCounts>, now: Date): PlayTitle[] {
  switch (f.kind) {
    case "new":
      return clips.filter((t) => isRecent(t, now, RECENT_DAYS)).sort(newestFirst);
    case "trending":
      return clips
        .filter((t) => (counts[t.id]?.views ?? 0) > 0)
        .sort((a, b) => (counts[b.id]?.views ?? 0) - (counts[a.id]?.views ?? 0) || newestFirst(a, b));
    case "genre":
      return clips.filter((t) => fold(t.genre?.trim() ?? "") === fold(f.genre)).sort(newestFirst);
    default:
      return [...clips].sort(discoverOrder);
  }
}

/** Paramètres d'adresse ← filtre (`?f=nouveautes`, `?f=tendances`, `?genre=Rap`). */
export function filterFromParams(f: string | null | undefined, genre: string | null | undefined): ClipFilter {
  if (genre && genre.trim()) return { kind: "genre", genre: genre.trim().slice(0, 40) };
  if (f === "nouveautes") return { kind: "new" };
  if (f === "tendances") return { kind: "trending" };
  return { kind: "discover" };
}

/** Adresse de l'accueil Clips pour un filtre et une recherche (60 caractères au plus). */
export function clipsHref(f: ClipFilter, q?: string | null): string {
  const p = new URLSearchParams();
  if (f.kind === "new") p.set("f", "nouveautes");
  else if (f.kind === "trending") p.set("f", "tendances");
  else if (f.kind === "genre") p.set("genre", f.genre);
  const v = (q ?? "").trim().slice(0, 60);
  if (v) p.set("q", v);
  const s = p.toString();
  return s ? `/play/clips?${s}` : "/play/clips";
}

/** Filtre demandé par l'adresse, ramené à « À découvrir » s'il n'existe pas (plus) dans ce catalogue. */
export function resolveFilter(wanted: ClipFilter, available: ClipFilter[]): ClipFilter {
  return available.find((a) => sameFilter(a, wanted)) ?? { kind: "discover" };
}

// ── Recherche ──────────────────────────────────────────────────────────────

/** Titre, artiste (le nom AFFICHÉ, plus celui saisi au dashboard) ou genre, avec ou sans accents. Vide : tout. */
export function searchClips(clips: PlayTitle[], artists: Record<string, ClipArtist>, query: string): PlayTitle[] {
  const q = fold(query.trim());
  if (!q) return clips;
  return clips.filter((t) =>
    [t.title, t.artist ?? "", clipArtistName(t, artists), t.genre ?? ""].some((s) => fold(s).includes(q)));
}

// ── Artiste d'un clip ──────────────────────────────────────────────────────

/** Nom affiché : le profil validé, sinon le nom saisi au dashboard (clip de Rivendy). */
export function clipArtistName(t: Pick<PlayTitle, "artist" | "artist_id">, artists: Record<string, ClipArtist>): string {
  const a = t.artist_id ? artists[t.artist_id] : undefined;
  return a?.name?.trim() || t.artist?.trim() || "Rivendy";
}

/** Initiales d'un nom d'artiste (« Mbayé Trambwé » → « MT »). */
export function artistInitials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => Array.from(w)[0] ?? "").join("").toLocaleUpperCase("fr") || "R";
}

/**
 * « Des artistes à suivre » : les artistes validés qui ont au moins un clip
 * dans CE catalogue, le plus prolifique d'abord, puis le plus récent.
 */
export function artistsToFollow(clips: PlayTitle[], artists: Record<string, ClipArtist>, max = 8): ClipArtist[] {
  const stats = new Map<string, { n: number; last: string }>();
  for (const t of clips) {
    if (!t.artist_id || !artists[t.artist_id]) continue;
    const s = stats.get(t.artist_id) ?? { n: 0, last: "" };
    s.n += 1;
    if ((t.published_at ?? "") > s.last) s.last = t.published_at ?? "";
    stats.set(t.artist_id, s);
  }
  return [...stats.entries()]
    .sort((a, b) => b[1].n - a[1].n || b[1].last.localeCompare(a[1].last))
    .slice(0, max)
    .map(([id]) => artists[id]);
}

// ── « À suivre » ───────────────────────────────────────────────────────────

export type SuggestionReason = "artist" | "genre" | "new";

/**
 * Suggestions sous un clip, avec la raison RÉELLE de chacune : d'abord le même
 * artiste, puis le même genre, puis les plus récents — jamais le clip en cours,
 * jamais deux fois le même. Ce n'est pas une recommandation personnalisée.
 */
export function clipSuggestions(current: PlayTitle, clips: PlayTitle[], max = 12): Array<{ clip: PlayTitle; reason: SuggestionReason }> {
  const others = clips.filter((t) => t.id !== current.id);
  const out: Array<{ clip: PlayTitle; reason: SuggestionReason }> = [];
  const used = new Set<string>();
  const take = (list: PlayTitle[], reason: SuggestionReason) => {
    for (const t of list) {
      if (out.length >= max) return;
      if (used.has(t.id)) continue;
      used.add(t.id);
      out.push({ clip: t, reason });
    }
  };
  const artistKey = (t: PlayTitle) => t.artist_id ?? (t.artist?.trim() ? `nom:${fold(t.artist.trim())}` : null);
  const mine = artistKey(current);
  if (mine) take(others.filter((t) => artistKey(t) === mine).sort(newestFirst), "artist");
  const g = current.genre?.trim();
  if (g) take(others.filter((t) => fold(t.genre?.trim() ?? "") === fold(g)).sort(newestFirst), "genre");
  take([...others].sort(newestFirst), "new");
  return out;
}

export function suggestionReasonLabel(r: SuggestionReason): string {
  return r === "artist" ? "Du même artiste" : r === "genre" ? "Même genre" : "Nouveauté";
}

// ── Commentaires (mêmes refus que l'app : play_social.dart) ────────────────

export interface ClipComment {
  id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
  parent_id: string | null;
  likes_count: number;
  pinned_at: string | null;
  creator_liked: boolean;
}

export function commentErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case "comments_off": return "Les commentaires sont fermés pour ce clip.";
    case "followers_only": return "Seuls les abonnés de l’artiste peuvent commenter ce clip.";
    case "blocked": return "Vous ne pouvez pas commenter ce clip.";
    case "contact_forbidden": return "Pas de numéro, de WhatsApp ni de lien : tout contact passe par Rivendy.";
    case "sanctioned": return "Votre compte ne peut plus publier ni commenter sur Rivendy Play et Rivendy Musique. Contactez Rivendy.";
    case "bad_length": return "Entre 2 et 500 caractères.";
    case "too_many": return "Vous commentez beaucoup : réessayez dans quelques minutes.";
    case "not_authenticated": return "Connectez-vous pour commenter.";
    case "not_found": return "Ce clip n’accepte plus de commentaires.";
    default: return "Impossible d’envoyer le commentaire. Réessayez.";
  }
}

/**
 * Fil : commentaires principaux (épinglé d'abord, puis du plus récent au plus
 * ancien), chacun avec ses réponses dans l'ordre d'arrivée. Les auteurs
 * bloqués par le spectateur disparaissent ; une réponse orpheline aussi.
 */
export function commentThreads(comments: ClipComment[], blocked: ReadonlySet<string>): Array<{ comment: ClipComment; replies: ClipComment[] }> {
  const visible = comments.filter((c) => !blocked.has(c.author_id));
  const tops = visible.filter((c) => !c.parent_id);
  const ids = new Set(tops.map((c) => c.id));
  const replies = new Map<string, ClipComment[]>();
  for (const c of visible) {
    if (c.parent_id && ids.has(c.parent_id)) replies.set(c.parent_id, [...(replies.get(c.parent_id) ?? []), c]);
  }
  return tops
    .sort((a, b) => (a.pinned_at ? 0 : 1) - (b.pinned_at ? 0 : 1) || b.created_at.localeCompare(a.created_at))
    .map((c) => ({ comment: c, replies: (replies.get(c.id) ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at)) }));
}

/** Qui peut commenter (choix de l'artiste, lot K) : le texte d'avance, le serveur décide. */
export function commentsModeNotice(mode: string | null | undefined): string | null {
  if (mode === "none") return "L’artiste a fermé les commentaires de ce clip.";
  if (mode === "followers") return "Seuls les abonnés de l’artiste peuvent commenter.";
  return null;
}

// ── Action demandée sans compte, faite au retour de la connexion ───────────

export interface PendingClipAction { kind: "like" | "follow"; id: string; at: number }
export const PENDING_ACTION_TTL_MS = 30 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valide 30 min, un type connu et un identifiant ; rien d'autre n'est gardé. */
export function parsePendingClipAction(raw: string | null | undefined, now: number): PendingClipAction | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { kind?: unknown; id?: unknown; at?: unknown };
    if ((v.kind !== "like" && v.kind !== "follow") || typeof v.id !== "string" || !UUID.test(v.id) || typeof v.at !== "number") return null;
    if (now - v.at > PENDING_ACTION_TTL_MS || v.at - now > 60_000) return null;
    return { kind: v.kind, id: v.id.toLowerCase(), at: v.at };
  } catch {
    return null;
  }
}

// ── Espace artiste ─────────────────────────────────────────────────────────

export type ArtistStatus = "none" | "pending" | "approved" | "rejected" | "suspended";

export function artistStatusOf(s: string | null | undefined): ArtistStatus {
  return s === "pending" || s === "approved" || s === "rejected" || s === "suspended" ? s : "none";
}

/** Bouton de la barre du haut : « Publier un clip » pour un artiste validé, sinon « Espace artiste ». */
export function artistCta(status: ArtistStatus): string {
  return status === "approved" ? "Publier un clip" : "Espace artiste";
}

/** État d'un clip de l'artiste (`play_my_clips`), en clair — miroir de `MyClip.state` de l'app. */
export function myClipStatusLabel(c: { status?: string | null; review_status?: string | null; video_status?: string | null }): string {
  if (c.review_status === "rejected") return "Refusé";
  if (c.review_status !== "approved") return "En vérification";
  if (c.video_status && c.video_status !== "ready") return c.video_status === "error" ? "Vidéo en erreur" : "Vidéo en préparation";
  return c.status === "published" ? "En ligne" : "Désactivé";
}
