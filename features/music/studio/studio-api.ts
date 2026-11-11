"use client";

import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { artistStatusOf, type ArtistStatus } from "@/features/play/clips/clips-logic";
import { artistErrorMessage, isoDay, studioErrorMessage, type Origin } from "./studio-logic";

/**
 * Publier depuis le site (lots 1 et 2, 2026-11-11) : EXACTEMENT les appels de
 * l'app (artist_service.dart, studio_service.dart). Toute écriture passe par
 * une fonction serveur (play_artist_*, music_artist_*) ; les images vont dans
 * le dossier du compte (avatars, banners, music-images) et les fichiers audio
 * partent directement du navigateur vers R2 par un lien signé
 * (musique-artist-upload). Rien ne transite par Vercel.
 */

/** Refus affichable : le message est prêt pour l'écran. */
export class StudioError extends Error {}

type RpcResult = { success?: boolean; error?: string | null; id?: string; status?: string };

async function rpcJson(name: string, params: Record<string, unknown>, messageOf: (code: string | null | undefined) => string): Promise<RpcResult> {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw new StudioError(messageOf(null));
  const res = (data ?? {}) as RpcResult;
  if (res.success !== true) throw new StudioError(messageOf(res.error ?? null));
  return res;
}

async function rpcBool(name: string, params: Record<string, unknown>): Promise<boolean> {
  const { data, error } = await supabase.rpc(name, params);
  return !error && data === true;
}

// ── Compte artiste ──────────────────────────────────────────────────────────

/** Colonnes de MON compte artiste (PlayArtist.mineColumns de l'app). */
const MY_ARTIST_COLUMNS =
  "id, user_id, name, genre, country_id, bio, avatar_url, banner_url, status, review_reason, island_id, music_enabled, name_request";

export type MyArtist = {
  id: string; user_id: string; name: string; genre: string | null; country_id: string | null; bio: string | null;
  avatar_url: string | null; banner_url: string | null; status: string; review_reason: string | null;
  island_id: string | null; music_enabled: boolean | null; name_request: string | null;
};

/** Mon compte artiste, ou null si je n'en ai pas demandé. */
export async function fetchMyArtist(userId: string): Promise<MyArtist | null> {
  const { data, error } = await supabase.from("play_artists").select(MY_ARTIST_COLUMNS).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MyArtist | null) ?? null;
}

/**
 * Photo (avatars) ou bannière (banners) déjà recadrée et compressée, dans le
 * dossier du compte : même chemin que l'app (image_upload_service.dart) — la
 * seule adresse que play_artist_save accepte.
 */
export async function uploadArtistImage(userId: string, image: Blob, kind: "avatar" | "banner"): Promise<string> {
  const bucket = kind === "avatar" ? "avatars" : "banners";
  const path = `${userId}/${userId}_${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, image, {
    contentType: "image/jpeg", upsert: true, cacheControl: "31536000",
  });
  if (error) throw new StudioError("L’image n’a pas pu être envoyée, réessayez.");
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Demande (ou mise à jour) du compte artiste. Renvoie le statut. */
export async function saveArtist(p: { name: string; genre: string; bio: string; avatarUrl: string | null; bannerUrl: string | null }): Promise<ArtistStatus> {
  const res = await rpcJson("play_artist_save", {
    p_name: p.name.trim(),
    p_genre: p.genre.trim(),
    p_bio: p.bio.trim(),
    p_avatar_url: p.avatarUrl,
    p_banner_url: p.bannerUrl,
    p_accept_rules: true,
  }, artistErrorMessage);
  return artistStatusOf(res.status);
}

/** Origine du profil (pays, région, île ; null = aucune), sans nouvelle vérification. */
export async function setArtistOrigin(originId: string | null): Promise<void> {
  await rpcJson("music_artist_set_origin", { p_origin_id: originId }, artistErrorMessage);
}

/** « Publier aussi sur Rivendy Musique » (artiste validé). */
export async function setMusicEnabled(on: boolean): Promise<void> {
  await rpcJson("play_artist_set_music", { p_on: on }, artistErrorMessage);
}

/** Demande de changement de nom d'un artiste validé ; vide = annuler la demande. */
export async function requestArtistName(name: string): Promise<void> {
  await rpcJson("play_artist_request_name", { p_name: name }, artistErrorMessage);
}

/** Origines actives : pays du monde, régions et îles (music_origins, comme l'app). */
export async function fetchOrigins(): Promise<Origin[]> {
  const { data, error } = await supabase.rpc("music_origins");
  if (error) throw new Error(error.message);
  return (data ?? []) as Origin[];
}

// ── Sorties ─────────────────────────────────────────────────────────────────

export type StudioTrack = {
  id: string; position: number; title: string; featuring: string | null; explicit: boolean;
  allow_shorts: boolean | null; audio_status: string | null; duration_seconds: number | null;
};

export type StudioRelease = {
  id: string; kind: string; title: string; featuring: string | null; description: string | null;
  cover_url: string | null; genre_id: string | null; island_id: string | null; release_date: string | null;
  explicit: boolean; status: string | null; review_status: string | null; review_reason: string | null;
  published_at: string | null; created_at: string; music_tracks: StudioTrack[];
};

/** StudioRelease.columns de l'app. */
const RELEASE_COLUMNS = "id, kind, title, featuring, description, cover_url, genre_id, island_id, release_date, explicit, status, "
  + "review_status, review_reason, published_at, created_at, "
  + "music_tracks(id, position, title, featuring, explicit, allow_shorts, audio_status, duration_seconds)";

function sorted(r: StudioRelease): StudioRelease {
  return { ...r, music_tracks: [...(r.music_tracks ?? [])].sort((a, b) => a.position - b.position) };
}

/** Mes sorties ENVOYÉES par moi, brouillons compris (la RLS rend celles de mon compte). */
export async function fetchStudioReleases(artistId: string): Promise<StudioRelease[]> {
  const { data, error } = await supabase.from("music_releases").select(RELEASE_COLUMNS)
    .eq("artist_id", artistId).not("submitted_by", "is", null)
    .order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  // Sélection composée (titres imbriqués) : le typage de supabase-js ne la lit pas.
  return ((data ?? []) as unknown as StudioRelease[]).map(sorted);
}

export async function fetchStudioRelease(id: string): Promise<StudioRelease | null> {
  const { data, error } = await supabase.from("music_releases").select(RELEASE_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? sorted(data as unknown as StudioRelease) : null;
}

export type StudioStats = { releases: Record<string, { month: number; total: number }>; followers: number };

/** Écoutes du mois et au total de mes sorties, et mes abonnés (music_my_release_stats). */
export async function fetchStudioStats(): Promise<StudioStats | null> {
  const { data, error } = await supabase.rpc("music_my_release_stats");
  if (error || !data || typeof data !== "object") return null;
  const raw = data as { releases?: Record<string, { month?: number; total?: number }>; followers?: number };
  const releases: StudioStats["releases"] = {};
  for (const [id, v] of Object.entries(raw.releases ?? {})) releases[id] = { month: Number(v?.month ?? 0), total: Number(v?.total ?? 0) };
  return { releases, followers: Number(raw.followers ?? 0) };
}

/** Crée (id null) ou modifie une sortie modifiable. Renvoie son id. */
export async function saveRelease(p: {
  id: string | null; kind: string; title: string; featuring: string; description: string; coverUrl: string | null;
  genreId: string | null; islandId: string | null; releaseDate: Date | null; explicit: boolean;
}): Promise<string> {
  const res = await rpcJson("music_artist_release_save", {
    p_id: p.id,
    p_kind: p.kind,
    p_title: p.title.trim(),
    p_featuring: p.featuring.trim(),
    p_description: p.description.trim(),
    p_cover_url: p.coverUrl,
    p_genre_id: p.genreId,
    p_island_id: p.islandId,
    p_release_date: p.releaseDate ? isoDay(p.releaseDate) : null,
    p_explicit: p.explicit,
  }, studioErrorMessage);
  return String(res.id);
}

/** Pochette (déjà carrée et compressée) dans le dossier de l'artiste du bucket music-images. */
export async function uploadCover(artistId: string, image: Blob): Promise<string> {
  const path = `artists/${artistId}/${Date.now()}_${image.size}.jpg`;
  const { error } = await supabase.storage.from("music-images").upload(path, image, { contentType: "image/jpeg", upsert: false });
  if (error) throw new StudioError("La pochette n’a pas pu être envoyée, réessayez.");
  return supabase.storage.from("music-images").getPublicUrl(path).data.publicUrl;
}

export async function submitRelease(id: string): Promise<void> {
  await rpcJson("music_artist_release_submit", { p_id: id, p_attest: true }, studioErrorMessage);
}

export async function withdrawRelease(id: string): Promise<void> {
  await rpcJson("music_artist_release_withdraw", { p_id: id }, studioErrorMessage);
}

export async function deleteRelease(id: string): Promise<boolean> {
  return rpcBool("music_artist_release_delete", { p_id: id });
}

// ── Titres ──────────────────────────────────────────────────────────────────

export async function saveTrack(p: {
  id: string | null; releaseId: string; title: string; featuring: string; explicit: boolean; allowShorts: boolean;
}): Promise<string> {
  const res = await rpcJson("music_artist_track_save", {
    p_id: p.id,
    p_release_id: p.releaseId,
    p_title: p.title.trim(),
    p_featuring: p.featuring.trim(),
    p_explicit: p.explicit,
    p_allow_shorts: p.allowShorts,
  }, studioErrorMessage);
  return String(res.id);
}

export async function reorderTracks(releaseId: string, ids: string[]): Promise<boolean> {
  return rpcBool("music_artist_tracks_reorder", { p_release_id: releaseId, p_ids: ids });
}

export async function deleteTrack(id: string): Promise<boolean> {
  return rpcBool("music_artist_track_delete", { p_id: id });
}

// ── Fichier audio d'un titre (musique-artist-upload) ────────────────────────

async function invokeUpload(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke("musique-artist-upload", { body });
  if (error) {
    let code: string | null = null;
    if (error instanceof FunctionsHttpError) {
      try { code = ((await error.context.json()) as { error?: string })?.error ?? null; } catch { code = null; }
    }
    throw new StudioError(code ? studioErrorMessage(code) : "L’envoi du fichier a échoué, réessayez.");
  }
  const res = (data ?? {}) as Record<string, unknown>;
  if (typeof res.error === "string") throw new StudioError(studioErrorMessage(res.error));
  return res;
}

/** Lien signé à usage unique pour déposer le fichier d'origine sur R2. */
export async function requestTrackUpload(trackId: string, file: File): Promise<{ uploadUrl: string; key: string; contentType: string }> {
  const ticket = await invokeUpload({ action: "url", track_id: trackId, filename: file.name, size: file.size });
  const uploadUrl = typeof ticket.upload_url === "string" ? ticket.upload_url : null;
  const key = typeof ticket.key === "string" ? ticket.key : null;
  if (!uploadUrl || !key) throw new StudioError("L’envoi n’a pas pu commencer, réessayez.");
  const contentType = typeof ticket.content_type === "string" ? ticket.content_type : "application/octet-stream";
  return { uploadUrl, key, contentType };
}

/** Le serveur relit le fichier sur R2 (taille réelle) et le rattache au titre. */
export async function confirmTrackUpload(trackId: string, key: string): Promise<void> {
  await invokeUpload({ action: "confirm", track_id: trackId, key });
}

/** Coupure réseau pendant l'envoi : le fichier peut être renvoyé tel quel. */
export class NetworkCutError extends StudioError {}

/** PUT direct navigateur → R2, avec l'avancement réellement remis au réseau. */
export function putFile(url: string, file: File, contentType: string, onProgress: (ratio: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
      ? resolve()
      : reject(new StudioError("Le fichier n’a pas pu être envoyé, réessayez.")));
    xhr.onerror = () => reject(new NetworkCutError("Envoi interrompu : le réseau a coupé."));
    xhr.onabort = () => reject(new StudioError("Envoi annulé."));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}
