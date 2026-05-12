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

export async function uploadProductPhotos(userId: string, files: File[]) {
  const urls: string[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const compressed = await compressImage(files[index]);
    const path = `${userId}/${Date.now()}_${index}.jpg`;
    const { error } = await supabase.storage
      .from("products-images")
      .upload(path, compressed, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) throw error;
    const { data } = supabase.storage.from("products-images").getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return urls;
}
