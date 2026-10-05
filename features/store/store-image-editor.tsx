"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Film, Loader2 } from "lucide-react";
import {
  MAX_VIDEO_SECONDS,
  VideoError,
  attachCoverVideo,
  createUploadTicket,
  deleteVideo,
  readVideoDuration,
  uploadVideoFile,
} from "@/lib/video/video-service";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { ImageCropperModal } from "@/features/store/image-cropper-modal";

/**
 * Édition des images de boutique DEPUIS la page boutique (pattern Facebook/
 * marketplace). Visible uniquement par le propriétaire. Recadrage avant upload
 * (option A) → l'image enregistrée est déjà cadrée, aucun champ de position.
 * Réutilise les champs existants `store_banner_url` / `avatar_url` + le bucket
 * Storage de l'app (`products-images`).
 */

// Upload direct du blob recadré. Buckets/chemins identiques à l'app
// (image_upload_service.dart) pour que les policies RLS Storage s'appliquent.
//   avatar     → bucket "avatars",  colonne avatar_url (partagé app+web)
//   couverture → bucket "banners",  colonne store_banner_url (partagé app+web)
async function uploadCropped(
  userId: string,
  blob: Blob,
  kind: "avatar" | "banner",
): Promise<boolean> {
  try {
    const bucket = kind === "avatar" ? "avatars" : "banners";
    const column = kind === "avatar" ? "avatar_url" : "store_banner_url";
    const path = `${userId}/${userId}_${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });
    if (upErr) {
      console.error(`[store-image] upload échoué (bucket=${bucket}):`, upErr.message);
      return false;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    // .select() : une écriture refusée par la RLS ne renvoie pas d'erreur —
    // seule une ligne relue prouve que l'image est enregistrée.
    const { data: written, error: dbErr } = await supabase
      .from("profiles")
      .update({ [column]: data.publicUrl, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("id");
    if (dbErr) console.error("[store-image] update profil échoué:", dbErr.message);
    return !dbErr && !!written && written.length > 0;
  } catch (e) {
    console.error("[store-image] exception:", e);
    return false;
  }
}

/* ── Bouton "Modifier la couverture" (overlay bannière) ──────────── */
export function StoreCoverEditButton({ sellerId }: { sellerId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

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
          if (f) { setPending(f); setErrMsg(null); }
          e.target.value = "";
        }}
      />
      {/* Positionné en haut (le bas de la bannière est occupé par la carte de stats flottante) */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/55 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-black/70"
      >
        <Camera className="h-3.5 w-3.5" />
        Modifier la couverture
      </button>

      {/* Message d'erreur inline (pas d'alert()) */}
      {errMsg && (
        <div className="absolute right-3 top-14 z-10 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow">
          {errMsg}
        </div>
      )}

      {pending && (
        <ImageCropperModal
          file={pending}
          aspect={3}
          targetWidth={1500}
          title="Recadrer la couverture"
          onCancel={() => setPending(null)}
          onConfirm={async (blob) => {
            const ok = await uploadCropped(user.id, blob, "banner");
            setPending(null);
            if (ok) router.refresh();
            else setErrMsg("Erreur lors de la mise à jour. Réessayez.");
          }}
        />
      )}
    </>
  );
}

/* ── Vidéo de couverture (Certifié / Pro) ─────────────────────────
   Miroir de seller_store_screen (app) : kind=store_cover → envoi direct à
   Cloudflare → attach-cover-video (qui détruit l'ancienne vidéo). Le forfait
   est vérifié par le SERVEUR (create-video-upload) ; la vidéo s'affiche dès
   que le webhook l'a déclarée prête — jamais « ready » posé côté client. */
export function StoreCoverVideoButton({ sellerId }: { sellerId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!user || user.id !== sellerId) return null;

  async function send(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const duration = await readVideoDuration(file);
      if (!Number.isFinite(duration) || duration > MAX_VIDEO_SECONDS + 0.5) {
        throw new VideoError(`Vidéo de ${MAX_VIDEO_SECONDS} secondes maximum : raccourcissez-la avant de l'envoyer.`);
      }
      const { uploadUrl, cfUid } = await createUploadTicket("store_cover");
      await uploadVideoFile(uploadUrl, file);
      const attached = await attachCoverVideo(cfUid);
      if (!attached) {
        await deleteVideo(cfUid); // pas d'orpheline facturée à vie (§1.9)
        throw new VideoError("La vidéo n'a pas pu être rattachée à votre boutique.");
      }
      setMsg({ ok: true, text: "Vidéo envoyée : elle apparaîtra sur votre boutique après traitement." });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "L'envoi de la vidéo a échoué, réessayez." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.target.value = "";
          if (f) void send(f);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="absolute right-3 top-14 z-10 flex items-center gap-1.5 rounded-full bg-black/55 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Film className="h-3.5 w-3.5" />}
        Vidéo de couverture
      </button>
      {msg && (
        <div
          className={`absolute right-3 top-[6.25rem] z-10 max-w-xs rounded-xl px-3 py-1.5 text-xs font-bold text-white shadow ${msg.ok ? "bg-[#009688]" : "bg-red-600"}`}
        >
          {msg.text}
        </div>
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
  const [errMsg, setErrMsg] = useState<string | null>(null);

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
          if (f) { setPending(f); setErrMsg(null); }
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

      {/* Tooltip d'erreur inline — pas de alert() */}
      {errMsg && (
        <div className="absolute -bottom-10 right-0 z-20 w-48 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow">
          {errMsg}
        </div>
      )}

      {pending && (
        <ImageCropperModal
          file={pending}
          aspect={1}
          targetWidth={600}
          round
          title="Recadrer la photo de profil"
          onCancel={() => setPending(null)}
          onConfirm={async (blob) => {
            const ok = await uploadCropped(user.id, blob, "avatar");
            setPending(null);
            if (ok) router.refresh();
            else setErrMsg("Erreur lors de la mise à jour. Réessayez.");
          }}
        />
      )}
    </>
  );
}
