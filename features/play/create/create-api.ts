"use client";

import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { attachVideoToProduct, deleteVideo } from "@/lib/video/video-service";
import {
  clipErrorMessage, commentsModeOf, isRetryableStatus, parseOffset, retryDelayMs, SHORT_ARTICLE_STATUSES,
  shortSubmitMessage, toShortArticle, TUS, videoTicketMessage, type CommentsMode, type ShortArticle,
} from "./create-logic";

/**
 * Publier des vidéos depuis le site (lots 3 et 4, 2026-11-11) : les MÊMES
 * appels que l'app (artist_service.dart, play_create_service.dart,
 * video_service.dart), rien d'autre. Le serveur décide de tout : compte,
 * quota, durée (create-video-upload), dépôt « à vérifier » (play_submit_clip,
 * play_submit_short), rattachement (attach-video). Aucune fonction serveur
 * n'est modifiée (PROTECTED_ZONES §1.9) : ce module s'en sert telles quelles.
 *
 * Le fichier part DIRECTEMENT du navigateur vers Cloudflare Stream, par
 * morceaux de 5 Mio (protocole tus) : jamais par Vercel (limite de 4,5 Mo).
 * Après une coupure, l'envoi reprend où il s'était arrêté. Un envoi raté rend
 * tout de suite sa place du quota (delete-video), comme l'app.
 */

export class UploadError extends Error {
  readonly cancelled: boolean;
  readonly networkCut: boolean;
  constructor(message: string, opts: { cancelled?: boolean; networkCut?: boolean } = {}) {
    super(message);
    this.cancelled = opts.cancelled ?? false;
    this.networkCut = opts.networkCut ?? false;
  }
}

const FAILED = "L’envoi de la vidéo a échoué, réessayez.";
const cancelledError = () => new UploadError("Envoi annulé.", { cancelled: true });

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

// ── Adresse d'envoi ──────────────────────────────────────────────────────────

export type VideoTicket = { uploadUrl: string; cfUid: string; protocol: "tus" | "basic" };

async function edgeError(error: unknown): Promise<{ code: string | null; limit: number | null }> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string; limit?: number };
      return { code: body?.error ?? null, limit: typeof body?.limit === "number" ? body.limit : null };
    } catch {
      return { code: null, limit: null };
    }
  }
  return { code: null, limit: null };
}

/**
 * Adresse d'envoi à usage unique. `kind` : `clip` (artiste validé, 10 min,
 * 10 par mois), `short` (Short libre, 30 s, quota de la formule) ou `product`
 * avec `fromPlay` (vidéo d'article créée depuis Play : 30 s). La taille est
 * annoncée : l'adresse rendue est une adresse tus (envoi reprenable).
 */
export async function requestVideoTicket(kind: "clip" | "short" | "product", file: File, opts: { fromPlay?: boolean } = {}): Promise<VideoTicket> {
  const message = (code: string | null, limit: number | null) => (kind === "clip" ? clipErrorMessage(code) : videoTicketMessage(code, limit));
  const body: Record<string, unknown> = { kind, resumable: true, upload_length: file.size };
  if (opts.fromPlay) body.context = "play";
  const { data, error } = await supabase.functions.invoke("create-video-upload", { body });
  if (error) {
    const { code, limit } = await edgeError(error);
    throw new UploadError(message(code, limit));
  }
  const p = data as { upload_url?: string; cf_uid?: string; protocol?: string; error?: string; limit?: number } | null;
  if (p?.error) throw new UploadError(message(p.error, typeof p.limit === "number" ? p.limit : null));
  if (!p?.upload_url || !p.cf_uid) throw new UploadError(message(null, null));
  return { uploadUrl: p.upload_url, cfUid: p.cf_uid, protocol: p.protocol === "tus" ? "tus" : "basic" };
}

// ── Envoi du fichier ─────────────────────────────────────────────────────────

export type UploadContext = {
  signal: AbortSignal;
  /** Avancement de 0 à 1. */
  onProgress: (ratio: number) => void;
  /** Coupure : reprise n° `attempt` (sur 5) dans `delayMs`. */
  onRetry: (attempt: number, delayMs: number) => void;
};

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(cancelledError());
      return;
    }
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(cancelledError());
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** Un morceau (PATCH tus), avec l'avancement des octets partis. */
function patchChunk(url: string, chunk: Blob, offset: number, onSent: (bytes: number) => void, signal: AbortSignal): Promise<{ status: number; offset: string | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
    xhr.open("PATCH", url);
    xhr.setRequestHeader("Tus-Resumable", "1.0.0");
    xhr.setRequestHeader("Upload-Offset", String(offset));
    xhr.setRequestHeader("Content-Type", "application/offset+octet-stream");
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (e) => onSent(e.loaded);
    xhr.onload = () => resolve({ status: xhr.status, offset: xhr.getResponseHeader("Upload-Offset") });
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.onabort = () => reject(cancelledError());
    xhr.onloadend = () => signal.removeEventListener("abort", onAbort);
    signal.addEventListener("abort", onAbort, { once: true });
    xhr.send(chunk);
  });
}

/** Position enregistrée par Cloudflare (HEAD → Upload-Offset), ou null s'il ne répond pas. */
async function serverOffset(url: string, signal: AbortSignal): Promise<number | null> {
  const timeout = new AbortController();
  const timer = window.setTimeout(() => timeout.abort(), 30_000);
  const onAbort = () => timeout.abort();
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    const res = await fetch(url, { method: "HEAD", headers: { "Tus-Resumable": "1.0.0" }, signal: timeout.signal, cache: "no-store" });
    return res.ok ? parseOffset(res.headers.get("Upload-Offset")) : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

/**
 * Envoi reprenable (tus), miroir du TusUploader de l'app : morceaux de
 * 5 Mio ; après une coupure, on relit la position chez Cloudflare et on
 * reprend de là, jusqu'à 5 fois de suite (1, 2, 4, 8 puis 16 s d'attente).
 */
async function tusUpload(url: string, file: File, ctx: UploadContext): Promise<void> {
  const length = file.size;
  let offset = 0;
  let failures = 0;
  ctx.onProgress(0);
  while (offset < length) {
    if (ctx.signal.aborted) throw cancelledError();
    const start = offset;
    const size = Math.min(TUS.chunkBytes, length - start);
    let next: number | null = null;
    let retry = false;
    try {
      const res = await patchChunk(url, file.slice(start, start + size), start,
        (sent) => ctx.onProgress(Math.min(1, (start + sent) / length)), ctx.signal);
      if (res.status === 204 || res.status === 200) next = parseOffset(res.offset) ?? start + size;
      else if (isRetryableStatus(res.status)) retry = true;
      else throw new UploadError(FAILED);
    } catch (e) {
      if (e instanceof UploadError) throw e;
      if (ctx.signal.aborted) throw cancelledError();
      retry = true;
    }
    if (!retry && next !== null) {
      offset = next;
      failures = 0;
      ctx.onProgress(offset / length);
      continue;
    }
    failures += 1;
    if (failures > TUS.maxRetries) throw new UploadError("Connexion perdue : l’envoi n’a pas pu reprendre. Réessayez.", { networkCut: true });
    const delay = retryDelayMs(failures);
    ctx.onRetry(failures, delay);
    await wait(delay, ctx.signal);
    const server = await serverOffset(url, ctx.signal);
    if (server !== null) offset = server;
  }
  ctx.onProgress(1);
}

/** Envoi simple (POST multipart), si le serveur n'a pas rendu d'adresse tus. */
function basicUpload(url: string, file: File, ctx: UploadContext): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) ctx.onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status < 400 ? resolve() : reject(new UploadError(FAILED)));
    xhr.onerror = () => reject(new UploadError(FAILED, { networkCut: true }));
    xhr.onabort = () => reject(cancelledError());
    xhr.onloadend = () => ctx.signal.removeEventListener("abort", onAbort);
    ctx.signal.addEventListener("abort", onAbort, { once: true });
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

/** Envoie le fichier ; en cas d'échec ou d'annulation, la place du quota est rendue tout de suite (audit 19, PL19-13). */
export async function uploadToTicket(ticket: VideoTicket, file: File, ctx: UploadContext): Promise<void> {
  try {
    if (ticket.protocol === "tus") await tusUpload(ticket.uploadUrl, file, ctx);
    else await basicUpload(ticket.uploadUrl, file, ctx);
  } catch (e) {
    void deleteVideo(ticket.cfUid).catch(() => false);
    throw e instanceof UploadError ? e : new UploadError(FAILED);
  }
}

// ── Clips d'artiste ──────────────────────────────────────────────────────────

export type ClipFields = { title: string; description: string; genre: string; trackId: string | null };

/** Envoi puis dépôt « en vérification » (play_submit_clip), puis le titre Musique relié (facultatif). */
export async function sendClip(ticket: VideoTicket, file: File, fields: ClipFields, ctx: UploadContext): Promise<void> {
  await uploadToTicket(ticket, file, ctx);
  const { data, error } = await supabase.rpc("play_submit_clip", {
    p_cf_uid: ticket.cfUid,
    p_title: fields.title.trim(),
    p_description: fields.description.trim(),
    p_genre: fields.genre.trim(),
  });
  if (error) throw new UploadError("L’envoi du clip a échoué, réessayez.");
  const res = (data ?? {}) as { success?: boolean; error?: string; id?: string };
  if (res.success !== true) {
    // Vidéo envoyée mais refusée au dépôt : on ne la laisse pas facturée.
    await deleteVideo(ticket.cfUid).catch(() => false);
    throw new UploadError(clipErrorMessage(res.error));
  }
  if (fields.trackId && typeof res.id === "string") {
    // Un échec du lien ne fait pas échouer l'envoi : il se refait en modifiant le clip.
    await linkClipTrack(res.id, fields.trackId).catch(() => undefined);
  }
}

function ensureOk(data: unknown, error: unknown): void {
  if (error) throw new UploadError(clipErrorMessage(null));
  const res = (data ?? {}) as { success?: boolean; error?: string };
  if (res.success !== true) throw new UploadError(clipErrorMessage(res.error));
}

/** Modifier le texte d'un de SES clips (la vidéo ne se remplace pas). */
export async function updateClip(id: string, f: { title: string; description: string; genre: string }): Promise<void> {
  const { data, error } = await supabase.rpc("play_update_my_clip", {
    p_id: id, p_title: f.title.trim(), p_description: f.description.trim(), p_genre: f.genre.trim(),
  });
  ensureOk(data, error);
}

/** Activer ou désactiver un clip approuvé. */
export async function setClipActive(id: string, active: boolean): Promise<void> {
  const { data, error } = await supabase.rpc("play_set_my_clip_active", { p_id: id, p_active: active });
  ensureOk(data, error);
}

/** Supprimer un clip et sa vidéo (avec ses J'aime et ses commentaires). */
export async function deleteClip(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("play_delete_my_clip", { p_id: id });
  return !error && data === true;
}

/** Relier SON clip à SON titre Musique (`null` : lien retiré). */
export async function linkClipTrack(clipId: string, trackId: string | null): Promise<void> {
  const { data, error } = await supabase.rpc("play_clip_link_track", { p_clip: clipId, p_track: trackId });
  ensureOk(data, error);
}

/** Titre relié et réglage des commentaires d'un clip en ligne (rien de lisible avant sa publication). */
export async function fetchClipSettings(clipId: string): Promise<{ trackId: string | null; commentsMode: CommentsMode }> {
  const { data, error } = await supabase.from("play_titles").select("music_track_id, comments_mode").eq("id", clipId).maybeSingle();
  if (error || !data) return { trackId: null, commentsMode: "all" };
  const row = data as { music_track_id?: string | null; comments_mode?: string | null };
  return { trackId: row.music_track_id ?? null, commentsMode: commentsModeOf(row.comments_mode) };
}

export type TrackOption = { id: string; title: string; release: string; online: boolean };

/** Titres de l'artiste, pour relier un clip au titre qu'il illustre (les siens seulement). */
export async function fetchMyTracks(artistId: string): Promise<TrackOption[]> {
  const { data, error } = await supabase
    .from("music_tracks")
    .select("id, title, position, music_releases!inner(id, title, artist_id, status)")
    .eq("music_releases.artist_id", artistId)
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Array<{ id: string; title: string | null; music_releases: { title: string | null; status: string | null } | null }>;
  return rows
    .filter((r) => typeof r.id === "string" && r.music_releases)
    .map((r) => ({ id: r.id, title: r.title ?? "", release: r.music_releases?.title ?? "", online: r.music_releases?.status === "published" }))
    .sort((a, b) => `${a.release}/${a.title}`.toLowerCase().localeCompare(`${b.release}/${b.title}`.toLowerCase(), "fr"));
}

/** Genre du profil d'artiste (proposé par défaut pour un nouveau clip). */
export async function fetchArtistGenre(artistId: string): Promise<string> {
  const { data } = await supabase.from("play_artists").select("genre").eq("id", artistId).maybeSingle();
  return ((data as { genre?: string | null } | null)?.genre ?? "").trim();
}

// ── Shorts ───────────────────────────────────────────────────────────────────

export type MyShort = {
  id: string; caption: string; video_uid: string; video_status: string | null; thumbnail_url: string | null;
  status: string; moderation_reason: string | null; comments_count: number; created_at: string; comments_mode: CommentsMode;
};

/** MES Shorts libres, tous statuts (la RLS laisse l'auteur lire les siens). Lève une erreur si la lecture échoue. */
export async function fetchMyShorts(): Promise<MyShort[]> {
  const u = await uid();
  if (!u) return [];
  const { data, error } = await supabase
    .from("play_user_shorts")
    .select("id, caption, video_uid, video_status, thumbnail_url, status, moderation_reason, comments_count, created_at, comments_mode")
    .eq("owner_id", u)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Partial<MyShort> & { id: string; comments_mode?: string | null }>).map((r) => ({
    id: r.id, caption: (r.caption ?? "").trim(), video_uid: r.video_uid ?? "", video_status: r.video_status ?? null,
    thumbnail_url: r.thumbnail_url ?? null, status: r.status ?? "pending", moderation_reason: r.moderation_reason?.trim() || null,
    comments_count: Number(r.comments_count ?? 0), created_at: r.created_at ?? "", comments_mode: commentsModeOf(r.comments_mode),
  }));
}

/** Supprimer un de MES Shorts (la vidéo est libérée côté serveur). */
export async function deleteMyShort(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("play_delete_my_short", { p_id: id });
  return !error && data === true;
}

/** Qui peut commenter : `title` pour un clip, `user_short` pour un Short. */
export async function setCommentsMode(kind: "title" | "user_short", id: string, mode: CommentsMode): Promise<boolean> {
  const { data, error } = await supabase.rpc("play_set_comments_mode", { p_kind: kind, p_id: id, p_mode: mode });
  return !error && data === true;
}

/** Articles du vendeur proposés pour un Short. Lève une erreur si la lecture échoue (vide = aucun article). */
export async function fetchMyArticles(): Promise<ShortArticle[]> {
  const u = await uid();
  if (!u) return [];
  const { data, error } = await supabase
    .from("products")
    .select("id, title, photos, status, video_uid")
    .eq("seller_id", u)
    .eq("is_deleted", false)
    .in("status", [...SHORT_ARTICLE_STATUSES])
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: string; title?: string | null; photos?: unknown; status?: string | null; video_uid?: string | null }>).map(toShortArticle);
}

async function shortExistsFor(cfUid: string): Promise<boolean> {
  const u = await uid();
  if (!u) return false;
  const { data } = await supabase.from("play_user_shorts").select("id").eq("owner_id", u).eq("video_uid", cfUid).maybeSingle();
  return !!data;
}

async function productHasVideo(productId: string, cfUid: string): Promise<boolean> {
  const { data } = await supabase.from("products").select("video_uid").eq("id", productId).maybeSingle();
  return (data as { video_uid?: string | null } | null)?.video_uid === cfUid;
}

/**
 * Short libre : envoi (30 s, quota de la formule), puis dépôt « à vérifier »
 * — visible après validation par Rivendy. `ready` : l'adresse déjà demandée
 * par la page (le quota s'affiche alors tout de suite) ; sinon, une nouvelle.
 */
export async function sendFreeShort(file: File, caption: string, ctx: UploadContext, ready?: VideoTicket | null): Promise<void> {
  const ticket = ready ?? await requestVideoTicket("short", file);
  await uploadToTicket(ticket, file, ctx);
  let res: { success?: boolean; error?: string } | null = null;
  try {
    const { data, error } = await supabase.rpc("play_submit_short", { p_cf_uid: ticket.cfUid, p_caption: caption.trim(), p_accept_rules: true });
    if (error) throw error;
    res = (data ?? {}) as { success?: boolean; error?: string };
  } catch {
    // Réponse perdue alors que le serveur a peut-être accepté : on vérifie
    // avant de supprimer la vidéo (audit 19, PL19-8).
    if (await shortExistsFor(ticket.cfUid)) return;
  }
  if (res?.success === true) return;
  await deleteVideo(ticket.cfUid).catch(() => false);
  throw new UploadError(shortSubmitMessage(res?.error));
}

/**
 * Short pour un article déjà publié : la vidéo (30 s, depuis Play) devient
 * celle de l'article (attach-video libère l'ancienne) et passe dans les Shorts.
 */
export async function sendShortToArticle(file: File, productId: string, ctx: UploadContext, ready?: VideoTicket | null): Promise<void> {
  const ticket = ready ?? await requestVideoTicket("product", file, { fromPlay: true });
  await uploadToTicket(ticket, file, ctx);
  if (await attachVideoToProduct(ticket.cfUid, productId)) return;
  // Réponse perdue alors que le rattachement a réussi : on relit l'article avant de supprimer (audit 19, PL19-8).
  if (await productHasVideo(productId, ticket.cfUid)) return;
  await deleteVideo(ticket.cfUid).catch(() => false);
  throw new UploadError("La vidéo n’a pas pu être ajoutée à l’article, réessayez.");
}
