"use client";

import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

/**
 * Vidéo (Cloudflare Stream) — miroir EXACT du contrat de l'app
 * (`lib/features/video/services/video_service.dart`, PROTECTED_ZONES §1.9).
 *
 * Règles reprises telles quelles :
 *  - le quota se vérifie CÔTÉ SERVEUR, à la demande d'URL (create-video-upload) ;
 *  - le jeton Cloudflare ne quitte jamais les Edge Functions ;
 *  - la vidéo ne bloque JAMAIS la publication : tout échec laisse un article
 *    photo valide ;
 *  - une vidéo supprimée DOIT l'être chez Cloudflare (delete-video) ;
 *  - le client ne pose jamais 'ready' : seul le webhook le fait.
 */

/** Durée maximale d'un clip (l'app rogne à 15 s ; Cloudflare refuse au-delà de 16). */
export const MAX_VIDEO_SECONDS = 15;

export class VideoError extends Error {}

function messageForCode(code: string | null | undefined, limit?: number | null): string {
  switch (code) {
    case "QUOTA_EXCEEDED":
      return limit != null
        ? `Quota vidéo atteint (${limit} ce mois-ci). Passez à une formule supérieure pour en publier plus.`
        : "Quota vidéo atteint. Passez à une formule supérieure pour en publier plus.";
    case "SUBSCRIPTION_REQUIRED":
      return "La vidéo de couverture est réservée aux vendeurs Certifié et Pro.";
    case "UNAUTHENTICATED":
      return "Connectez-vous pour publier une vidéo.";
    default:
      return "L'envoi de la vidéo a échoué, réessayez.";
  }
}

/** Lit le code métier renvoyé par une Edge Function, y compris en 4xx. */
async function errorCodeOf(error: unknown): Promise<{ code: string | null; limit: number | null }> {
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

/** Durée d'un fichier vidéo, lue par le navigateur (secondes). */
export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new VideoError("Ce fichier vidéo ne peut pas être lu."));
    };
    video.src = url;
  });
}

/** URL d'envoi à usage unique — le serveur vérifie forfait et quota. */
export async function createUploadTicket(kind: "product" | "store_cover" = "product") {
  const { data, error } = await supabase.functions.invoke("create-video-upload", { body: { kind } });
  if (error) {
    const { code, limit } = await errorCodeOf(error);
    throw new VideoError(messageForCode(code, limit));
  }
  const payload = data as { upload_url?: string; cf_uid?: string; error?: string; limit?: number } | null;
  if (payload?.error) throw new VideoError(messageForCode(payload.error, payload.limit));
  if (!payload?.upload_url || !payload?.cf_uid) throw new VideoError(messageForCode(null));
  return { uploadUrl: payload.upload_url, cfUid: payload.cf_uid };
}

/** Envoi direct navigateur → Cloudflare (POST multipart « file »). */
export function uploadVideoFile(uploadUrl: string, file: File, onProgress?: (ratio: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status < 400 ? resolve() : reject(new VideoError(messageForCode(null))));
    xhr.onerror = () => reject(new VideoError(messageForCode(null)));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

/** Rattache la vidéo à l'article (Edge Function attach-video). */
export async function attachVideoToProduct(cfUid: string, productId: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke("attach-video", {
    body: { cf_uid: cfUid, product_id: productId },
  });
  return !error && (data as { attached?: boolean } | null)?.attached === true;
}

/** Rattache la vidéo de couverture à la boutique (attach-cover-video). */
export async function attachCoverVideo(cfUid: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke("attach-cover-video", { body: { cf_uid: cfUid } });
  return !error && (data as { attached?: boolean } | null)?.attached === true;
}

/** Supprime la vidéo chez Cloudflare ET la marque au registre (delete-video). */
export async function deleteVideo(cfUid: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke("delete-video", { body: { cf_uid: cfUid } });
  return !error && (data as { deleted?: boolean } | null)?.deleted === true;
}

/**
 * Parcours complet « envoyer puis rattacher » pour un article déjà créé.
 * Jamais bloquant : renvoie un message à afficher en cas d'échec, `null` sinon.
 */
export async function uploadProductVideo(
  file: File,
  productId: string,
  onProgress?: (ratio: number) => void,
): Promise<string | null> {
  try {
    const { uploadUrl, cfUid } = await createUploadTicket("product");
    await uploadVideoFile(uploadUrl, file, onProgress);
    const attached = await attachVideoToProduct(cfUid, productId);
    if (!attached) {
      // Vidéo envoyée mais non rattachée : on la supprime pour ne pas laisser
      // une orpheline facturée à vie (§1.9).
      await deleteVideo(cfUid);
      return "La vidéo n'a pas pu être rattachée à l'article. Votre article est publié avec ses photos.";
    }
    return null;
  } catch (err) {
    return err instanceof VideoError ? `${err.message} Votre article est publié avec ses photos.` : "L'envoi de la vidéo a échoué. Votre article est publié avec ses photos.";
  }
}
