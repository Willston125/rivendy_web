"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { compressImage } from "@/services/image-upload";
import { ImageCropperModal } from "@/features/store/image-cropper-modal";

/**
 * Édition des images de boutique DEPUIS la page boutique (pattern Facebook/
 * marketplace). Visible uniquement par le propriétaire. Recadrage avant upload
 * (option A) → l'image enregistrée est déjà cadrée, aucun champ de position.
 * Réutilise les champs existants `store_banner_url` / `avatar_url` + le bucket
 * Storage de l'app (`products-images`).
 */

async function uploadCropped(
  userId: string,
  blob: Blob,
  column: "store_banner_url" | "avatar_url",
  maxDim: number,
): Promise<boolean> {
  const file = new File([blob], "crop.jpg", { type: "image/jpeg" });
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
  const [pending, setPending] = useState<File | null>(null);

  if (!user || user.id !== sellerId) return null;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f) setPending(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-black/55 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-black/70"
      >
        <Camera className="h-3.5 w-3.5" />
        Modifier la couverture
      </button>

      {pending && (
        <ImageCropperModal
          file={pending}
          aspect={3}
          targetWidth={1500}
          title="Recadrer la couverture"
          onCancel={() => setPending(null)}
          onConfirm={async (blob) => {
            const ok = await uploadCropped(user.id, blob, "store_banner_url", 1600);
            setPending(null);
            if (ok) router.refresh();
            else alert("Erreur lors de la mise à jour de la couverture.");
          }}
        />
      )}
    </>
  );
}

/* ── Badge caméra sur l'avatar ───────────────────────────────────── */
export function StoreAvatarEditButton({ sellerId }: { sellerId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);

  if (!user || user.id !== sellerId) return null;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f) setPending(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="Modifier la photo de profil"
        className="absolute -bottom-1 -right-1 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#009688] text-white shadow-md transition hover:bg-[#00796B]"
      >
        <Camera className="h-3.5 w-3.5" />
      </button>

      {pending && (
        <ImageCropperModal
          file={pending}
          aspect={1}
          targetWidth={600}
          round
          title="Recadrer la photo de profil"
          onCancel={() => setPending(null)}
          onConfirm={async (blob) => {
            const ok = await uploadCropped(user.id, blob, "avatar_url", 800);
            setPending(null);
            if (ok) router.refresh();
            else alert("Erreur lors de la mise à jour de la photo de profil.");
          }}
        />
      )}
    </>
  );
}
