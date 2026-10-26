import { supabase } from "@/lib/supabase/client";
import { TITLE_COLUMNS, isListable, kindOf, type PlayTitle } from "../play-logic";
import type { ClipArtist, ClipComment, ClipCounts } from "./clips-logic";

/**
 * Rivendy Clips — lectures et écritures depuis le navigateur (refonte du
 * 2026-10-26). Les MÊMES tables et fonctions que l'app (fiche d'un clip,
 * commentaires, espace artiste) : un J'aime, un commentaire ou un abonnement
 * donné sur le site se retrouve dans l'app, et inversement. Aucune table
 * nouvelle, aucune fonction serveur nouvelle.
 */

/** Colonnes d'un clip : celles d'un titre Play + compteur et réglage des commentaires (lus par l'app aussi, sans compte). */
export const CLIP_COLUMNS = `${TITLE_COLUMNS}, comments_count, comments_mode`;

/** Colonnes PUBLIQUES d'un artiste (jamais `name_request`, réservé à son compte). */
const ARTIST_COLUMNS = "id, user_id, name, genre, bio, avatar_url, banner_url";

export type Clip = PlayTitle & { comments_count?: number | null; comments_mode?: string | null };

function must<T>(res: { data: T | null; error: { message: string } | null }, empty: T): T {
  if (res.error) throw new Error(res.error.message);
  return res.data ?? empty;
}

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

const chunks = <T,>(list: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

// ── Catalogue ──────────────────────────────────────────────────────────────

/**
 * Clips publiés et prêts dans un marché (jointure play_title_countries, comme
 * l'app : 200 au plus). Lève en cas de panne — « Réessayer », jamais un faux
 * catalogue vide.
 */
export async function fetchClips(market: string): Promise<Clip[]> {
  const res = await supabase.from("play_titles").select(`${CLIP_COLUMNS}, play_title_countries!inner(country_id)`)
    .eq("status", "published").eq("kind", "clip").eq("play_title_countries.country_id", market)
    .order("published_at", { ascending: false }).limit(200);
  return (must(res, []) as unknown as Clip[]).filter(isListable);
}

/** Un clip (lien direct, suggestion hors du marché) ; null s'il n'est plus publié. */
export async function fetchClip(id: string): Promise<Clip | null> {
  const { data, error } = await supabase.from("play_titles").select(`${CLIP_COLUMNS}, play_title_countries(country_id)`)
    .eq("id", id).eq("status", "published").maybeSingle();
  if (error) throw new Error(error.message);
  const t = data as unknown as Clip | null;
  return t && kindOf(t.kind) === "clip" ? t : null;
}

/** Vues et J'aime comptés par le serveur. Best effort : sans eux, aucun chiffre affiché. */
export async function fetchClipCounts(ids: string[]): Promise<Record<string, ClipCounts>> {
  const out: Record<string, ClipCounts> = {};
  for (const part of chunks([...new Set(ids)], 200)) {
    const { data, error } = await supabase.from("play_short_counters").select("target_id, likes_count, views_count")
      .eq("target_kind", "title").in("target_id", part);
    if (error) continue;
    for (const r of (data ?? []) as Array<{ target_id: string; likes_count: number | null; views_count: number | null }>) {
      out[r.target_id] = { views: Number(r.views_count ?? 0), likes: Number(r.likes_count ?? 0) };
    }
  }
  return out;
}

/** Profils publics des artistes (validés : la RLS ne rend que ceux-là). Best effort. */
export async function fetchClipArtists(ids: string[]): Promise<Record<string, ClipArtist>> {
  const out: Record<string, ClipArtist> = {};
  for (const part of chunks([...new Set(ids.filter(Boolean))], 200)) {
    const { data, error } = await supabase.from("play_artists").select(ARTIST_COLUMNS).in("id", part);
    if (error) continue;
    for (const a of (data ?? []) as ClipArtist[]) out[a.id] = a;
  }
  return out;
}

// ── Compte : J'aime, abonnements, comptes bloqués ──────────────────────────

/** J'aime du compte sur ce clip (même table que l'app et les Shorts). */
export async function fetchLiked(titleId: string): Promise<boolean> {
  const u = await uid();
  if (!u) return false;
  const { data } = await supabase.from("play_short_likes").select("title_id").eq("user_id", u).eq("title_id", titleId).limit(1);
  return (data ?? []).length > 0;
}

/** Aimer / ne plus aimer. Renvoie faux si le serveur refuse. */
export async function setLiked(titleId: string, on: boolean): Promise<boolean> {
  const u = await uid();
  if (!u) return false;
  if (on) {
    const { error } = await supabase.from("play_short_likes").insert({ user_id: u, title_id: titleId });
    return !error || error.code === "23505"; // déjà aimé
  }
  const { error } = await supabase.from("play_short_likes").delete().eq("user_id", u).eq("title_id", titleId);
  return !error;
}

/** Nombre d'abonnés d'une personne (public). */
export async function fetchFollowers(userId: string): Promise<number> {
  const { data } = await supabase.from("play_follow_counts").select("followers").eq("user_id", userId).maybeSingle();
  return Number((data as { followers?: number } | null)?.followers ?? 0);
}

/** Nombres d'abonnés de plusieurs personnes (public). Best effort. */
export async function fetchFollowerCounts(userIds: string[]): Promise<Record<string, number>> {
  const ids = [...new Set(userIds.filter(Boolean))].slice(0, 200);
  if (ids.length === 0) return {};
  const { data, error } = await supabase.from("play_follow_counts").select("user_id, followers").in("user_id", ids);
  if (error) return {};
  return Object.fromEntries(((data ?? []) as Array<{ user_id: string; followers: number | null }>).map((r) => [r.user_id, Number(r.followers ?? 0)]));
}

/** Personnes suivies par le compte (ses propres lignes, RLS). */
export async function fetchFollowedIds(): Promise<string[]> {
  if (!(await uid())) return [];
  const res = await supabase.from("play_follows").select("followed_id").order("created_at", { ascending: false }).limit(1000);
  return (must(res, []) as Array<{ followed_id: string }>).map((r) => r.followed_id);
}

/** Comptes bloqués par le spectateur : leurs commentaires sont masqués (comme dans l'app). */
export async function fetchBlockedIds(): Promise<Set<string>> {
  if (!(await uid())) return new Set();
  const { data } = await supabase.from("user_blocks").select("blocked_id").limit(1000);
  return new Set(((data ?? []) as Array<{ blocked_id: string }>).map((r) => r.blocked_id));
}

/** Profils artistes de personnes suivies (validés seulement, RLS). Best effort. */
export async function fetchArtistsOfPeople(userIds: string[]): Promise<ClipArtist[]> {
  const ids = [...new Set(userIds.filter(Boolean))].slice(0, 500);
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("play_artists").select(ARTIST_COLUMNS).in("user_id", ids).eq("status", "approved");
  return error ? [] : ((data ?? []) as ClipArtist[]);
}

// ── Historique des clips (play_view_history, cible « title ») ──────────────

/** Clips vus par le compte, du plus récent au plus ancien (un titre peut revenir à plusieurs dates). Lève en cas de panne. */
export async function fetchClipHistory(): Promise<Array<{ clip: Clip; viewed_at: string }>> {
  if (!(await uid())) return [];
  const res = await supabase.from("play_view_history").select("target_id, viewed_at")
    .eq("target_kind", "title").order("viewed_at", { ascending: false }).limit(200);
  const rows = must(res, []) as Array<{ target_id: string; viewed_at: string }>;
  const ids = [...new Set(rows.map((r) => r.target_id))];
  const titles: Clip[] = [];
  for (const part of chunks(ids, 200)) {
    const r = await supabase.from("play_titles").select(CLIP_COLUMNS).eq("status", "published").eq("kind", "clip").in("id", part);
    titles.push(...(must(r, []) as unknown as Clip[]));
  }
  const byId = new Map(titles.map((t) => [t.id, t]));
  const seen = new Set<string>();
  // Un clip une fois, à sa dernière date de visionnage.
  return rows.flatMap((r) => {
    const clip = byId.get(r.target_id);
    if (!clip || seen.has(clip.id)) return [];
    seen.add(clip.id);
    return [{ clip, viewed_at: r.viewed_at }];
  });
}

/** Retire des clips de l'historique (les films et séries n'y sont pas touchés). */
export async function forgetClipHistory(ids: string[]): Promise<boolean> {
  const u = await uid();
  if (!u || ids.length === 0) return false;
  const { error } = await supabase.from("play_view_history").delete().eq("user_id", u).eq("target_kind", "title").in("target_id", ids.slice(0, 200));
  return !error;
}

/** Clips d'une liste d'identifiants (Enregistrements), publiés seulement, dans l'ordre donné. */
export async function fetchClipsByIds(ids: string[]): Promise<Clip[]> {
  const out: Clip[] = [];
  for (const part of chunks([...new Set(ids)], 200)) {
    const r = await supabase.from("play_titles").select(CLIP_COLUMNS).eq("status", "published").eq("kind", "clip").in("id", part);
    out.push(...(must(r, []) as unknown as Clip[]));
  }
  const byId = new Map(out.map((t) => [t.id, t]));
  return ids.map((id) => byId.get(id)).filter((t): t is Clip => !!t);
}

// ── Commentaires (play_short_comments, fonctions de l'app) ─────────────────

const COMMENT_COLUMNS = "id, author_id, author_name, body, created_at, parent_id, likes_count, pinned_at, creator_liked";
export const COMMENTS_MAX = 200;

/** Commentaires visibles d'un clip, les plus récents d'abord (200 au plus). Lève en cas de panne. */
export async function fetchComments(titleId: string): Promise<ClipComment[]> {
  const res = await supabase.from("play_short_comments").select(COMMENT_COLUMNS)
    .eq("title_id", titleId).order("created_at", { ascending: false }).limit(COMMENTS_MAX);
  return (must(res, []) as Array<Partial<ClipComment>>).map((r) => ({
    id: String(r.id),
    author_id: r.author_id ?? "",
    author_name: (r.author_name ?? "").trim() || "Utilisateur Rivendy",
    body: r.body ?? "",
    created_at: r.created_at ?? "",
    parent_id: r.parent_id ?? null,
    likes_count: Number(r.likes_count ?? 0),
    pinned_at: r.pinned_at ?? null,
    creator_liked: r.creator_liked === true,
  }));
}

export type CommentWrite = { ok: true; comment: ClipComment } | { ok: false; error: string };

function commentResult(data: unknown, error: { message: string } | null): CommentWrite {
  if (error) return { ok: false, error: "network" };
  const r = data as { success?: boolean; error?: string; comment?: Partial<ClipComment> } | null;
  if (!r?.success || !r.comment?.id) return { ok: false, error: r?.error ?? "unknown" };
  const c = r.comment;
  return {
    ok: true,
    comment: {
      id: String(c.id), author_id: c.author_id ?? "", author_name: (c.author_name ?? "").trim() || "Utilisateur Rivendy",
      body: c.body ?? "", created_at: c.created_at ?? new Date().toISOString(), parent_id: c.parent_id ?? null,
      likes_count: Number(c.likes_count ?? 0), pinned_at: c.pinned_at ?? null, creator_liked: c.creator_liked === true,
    },
  };
}

export async function addComment(titleId: string, body: string): Promise<CommentWrite> {
  const { data, error } = await supabase.rpc("play_add_short_comment", { p_title_id: titleId, p_user_short_id: null, p_body: body.trim() });
  return commentResult(data, error);
}

/** Réponse : toujours rattachée au commentaire principal (comme l'app). */
export async function replyComment(parentId: string, body: string): Promise<CommentWrite> {
  const { data, error } = await supabase.rpc("play_reply_short_comment", { p_parent_id: parentId, p_body: body.trim() });
  const res = commentResult(data, error);
  return res.ok && !res.comment.parent_id ? { ok: true, comment: { ...res.comment, parent_id: parentId } } : res;
}

export async function deleteComment(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("play_delete_short_comment", { p_comment_id: id });
  return !error && data === true;
}

/** Signaler : le commentaire est masqué tout de suite, Rivendy tranche. */
export async function reportComment(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("play_report_short_comment", { p_comment_id: id });
  return !error && data === true;
}

export async function fetchLikedComments(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0 || !(await uid())) return new Set();
  const { data } = await supabase.from("play_short_comment_likes").select("comment_id").in("comment_id", ids.slice(0, 200));
  return new Set(((data ?? []) as Array<{ comment_id: string }>).map((r) => r.comment_id));
}

/** J'aime sur un commentaire : renvoie le nouveau total, ou null si refusé. */
export async function setCommentLiked(id: string, on: boolean): Promise<number | null> {
  const { data, error } = await supabase.rpc("play_set_comment_like", { p_comment_id: id, p_liked: on });
  return error || typeof data !== "number" ? null : data;
}

// ── Signalement d'un clip d'artiste (play_clip_reports) ────────────────────

/** Motifs de l'app (artist_report_sheet.dart + ReportReason), « Droits d'auteur » d'abord. */
export const CLIP_REPORT_REASONS: Array<{ key: string; label: string }> = [
  { key: "copyright", label: "Droits d’auteur (musique, vidéo, image)" },
  { key: "pornography", label: "Contenu pornographique / sexuel" },
  { key: "violence", label: "Violence / contenu choquant" },
  { key: "illegal", label: "Produit illégal" },
  { key: "fake", label: "Fausse annonce / arnaque" },
  { key: "inappropriate", label: "Contenu inapproprié" },
  { key: "spam", label: "Spam / publicité abusive" },
  { key: "other", label: "Autre raison" },
];

export async function reportClip(titleId: string, reason: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("play_report_clip", { p_id: titleId, p_reason: reason, p_details: "" });
  return !error && (data as { success?: boolean } | null)?.success === true;
}

// ── Espace artiste ─────────────────────────────────────────────────────────

export type MyArtist = { id: string; name: string; status: string; avatar_url: string | null; review_reason: string | null };

/** Profil artiste du compte (son propre profil, quel que soit son statut). */
export async function fetchMyArtist(): Promise<MyArtist | null> {
  const u = await uid();
  if (!u) return null;
  const res = await supabase.from("play_artists").select("id, name, status, avatar_url, review_reason").eq("user_id", u).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return (res.data as MyArtist | null) ?? null;
}

export type MyClip = {
  id: string; title: string; status: string; review_status: string | null; review_reason: string | null;
  video_status: string | null; thumbnail_url: string | null; duration_seconds: number | null;
  views: number; likes: number; comments_count: number; created_at: string;
};

/** Clips de l'artiste (tous statuts), par la même fonction que l'app. */
export async function fetchMyClips(): Promise<MyClip[]> {
  const { data, error } = await supabase.rpc("play_my_clips");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Partial<MyClip> & { id: string }>).map((c) => ({
    id: c.id, title: c.title ?? "", status: c.status ?? "draft", review_status: c.review_status ?? null,
    review_reason: c.review_reason ?? null, video_status: c.video_status ?? null, thumbnail_url: c.thumbnail_url ?? null,
    duration_seconds: c.duration_seconds ?? null, views: Number(c.views ?? 0), likes: Number(c.likes ?? 0),
    comments_count: Number(c.comments_count ?? 0), created_at: c.created_at ?? "",
  }));
}
