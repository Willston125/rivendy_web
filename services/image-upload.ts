"use client";

import { supabase } from "@/lib/supabase/client";

export async function compressImage(file: File, maxSize = 1400, quality = 0.82) {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * ratio);
  const height = Math.round(bitmap.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });

  return new File([blob ?? file], file.name.replace(/\.[^.]+$/, ".jpg"), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

/**
 * Recadre au centre au rapport voulu (largeur / hauteur), puis compresse en
 * JPEG : les réglages de l'app (ImageService : pochette et photo carrées,
 * bannière 16:9, 1080 px, qualité 75 %). Utilisé par l'espace artiste et le
 * studio Musique (2026-11-11) ; le fichier part ensuite directement vers le
 * stockage, jamais par une route Vercel.
 */
export async function cropToAspect(file: File, aspect: number, maxSide = 1080, quality = 0.75): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (sw / sh > aspect) sw = Math.round(sh * aspect);
  else sh = Math.round(sw / aspect);
  const sx = Math.round((bitmap.width - sw) / 2);
  const sy = Math.round((bitmap.height - sh) / 2);
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponible");
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("compression impossible");
  return blob;
}

export async function uploadProductPhotos(userId: string, files: File[]) {
  const urls: string[] = [];

  for (let index = 0; index < files.length; index += 1) {
    // Mêmes réglages que l'app (ImageService : 1080 px, JPEG 75 %) : une
    // photo publiée depuis le site pèse autant qu'une photo de l'app.
    const compressed = await compressImage(files[index], 1080, 0.75);
    const path = `${userId}/${Date.now()}_${index}.jpg`;
    const { error } = await supabase.storage
      .from("products-images")
      .upload(path, compressed, {
        contentType: "image/jpeg",
        upsert: false,
        // Nom unique (horodaté, jamais réécrit) : le navigateur et le CDN
        // peuvent garder la photo un an au lieu d'une heure (audit 17, WEB-18).
        cacheControl: "31536000",
      });

    if (error) throw error;
    const { data } = supabase.storage.from("products-images").getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return urls;
}
