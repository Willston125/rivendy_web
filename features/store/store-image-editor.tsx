"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { compressImage } from "@/services/image-upload";

/**
 * Édition des images de boutique DEPUIS la page boutique (pattern Facebook/
 * marketplace). Visible uniquement par le propriétaire. Réutilise les champs
 * existants `store_banner_url` / `avatar_url` (aucune donnée ajoutée) et le
 * même bucket Storage que l'app (`products-images`).
 */

async function uploadStoreImage(
  userId: string,
  file: File,
  column: "store_banner_url" | "avatar_url",
  maxDim: number,
): Promise<boolean> {
  const compressed = await compressImage(file, maxDim, 0.85);
  const folder = column === "avatar_url" ? "avatars" : "banners";
  const path = `${folder}/${userId}/${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("products-images")
    .upload(path, compressed, { contentType: "image/jpeg", upsert: true });
  if (upErr) return false;
  const { data } = supabase.storage.from("products-images").getPublicUrl(path);
  const { error: dbErr } = await supabase
    .from("profiles")
    .update({ [column]: data.publicUrl, updated_at: new Date().toISOString() })
    .eq("id", userId);
  return !dbErr;
}

/* ── Bouton "Modifier la couverture" (overlay bannière) ──────────── */
export function StoreCoverEditButton({ sellerId }: { sellerId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!user || user.id !== sellerId) return null;

  async function pick(file: File | null) {
    if (!file || !user) return;
    setUploading(true);
    const ok = await uploadStoreImage(user.id, file, "store_banner_url", 1600);
    setUploading(false);
    if (ok) router.refresh();
    else alert("Erreur lors de la mise à jour de la couverture.");
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-black/55 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-60"
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
        {uploading ? "Envoi…" : "Modifier la couverture"}
      </button>
    </>
  );
}

/* ── Badge caméra sur l'avatar ───────────────────────────────────── */
export function StoreAvatarEditButton({ sellerId }: { sellerId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!user || user.id !== sellerId) return null;

  async function pick(file: File | null) {
    if (!file || !user) return;
    setUploading(true);
    const ok = await uploadStoreImage(user.id, file, "avatar_url", 800);
    setUploading(false);
    if (ok) router.refresh();
    else alert("Erreur lors de la mise à jour de la photo de profil.");
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label="Modifier la photo de profil"
        className="absolute -bottom-1 -right-1 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#009688] text-white shadow-md transition hover:bg-[#00796B] disabled:opacity-60"
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
      </button>
    </>
  );
}
