"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { TUS } from "./create-logic";
import {
  cancelVideoUpload, dismissVideoUpload, retryVideoUpload, useInlineUploadShown, useInlineUploadSlot, useVideoUpload,
  type VideoUpload,
} from "./video-uploads";

/**
 * Bandeau d'envoi vidéo (lots 3 et 4, 2026-11-11) : il suit l'envoi sur tout
 * le site — en bas sur téléphone, au-dessus des barres de navigation, en haut
 * à droite sur ordinateur (le bas est aux lecteurs). Masqué quand la page
 * montre déjà l'envoi dans son contenu.
 */
export function VideoUploadBanner() {
  const upload = useVideoUpload();
  const inline = useInlineUploadShown();
  const id = upload?.id ?? null;
  const phase = upload?.phase ?? null;

  // Fin réussie : le bandeau s'efface seul au bout de 8 s.
  useEffect(() => {
    if (phase !== "done" || inline) return;
    const t = window.setTimeout(dismissVideoUpload, 8000);
    return () => window.clearTimeout(t);
  }, [id, phase, inline]);

  if (!upload || inline) return null;
  return (
    <div className="fixed inset-x-2 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[45] md:inset-x-auto md:bottom-auto md:right-6 md:top-24 md:w-[400px]">
      <UploadPanel upload={upload} floating />
    </div>
  );
}

/** L'envoi dans le contenu d'une page (espace artiste, Mes Shorts) ; `kind` : seulement ce type de vidéo. */
export function VideoUploadCard({ kind }: { kind?: "clip" | "short" }) {
  const upload = useVideoUpload();
  if (!upload || (kind && upload.kind !== kind)) return null;
  return <InlinePanel upload={upload} />;
}

function InlinePanel({ upload }: { upload: VideoUpload }) {
  useInlineUploadSlot();
  return <UploadPanel upload={upload} />;
}

const smallBtn = "inline-flex h-10 shrink-0 items-center justify-center rounded-xl px-3.5 text-[13.5px] font-bold transition";

function UploadPanel({ upload, floating = false }: { upload: VideoUpload; floating?: boolean }) {
  const pct = Math.round(upload.progress * 100);
  const busy = upload.phase === "uploading" || upload.phase === "retrying";
  return (
    <section aria-label="Envoi de la vidéo"
      className={cn("rounded-2xl border bg-rvp-frame p-3.5 text-rvp-text",
        floating && "shadow-[0_18px_40px_-16px_rgba(0,0,0,0.8)]",
        upload.phase === "failed" ? "border-red-400/55" : upload.phase === "retrying" ? "border-amber-300/55" : "border-rvp-edge-strong")}>
      {busy ? (
        <>
          <div className="flex items-center gap-3">
            <p className="line-clamp-2 min-w-0 flex-1 text-[13.5px] font-semibold leading-snug">{upload.label}</p>
            <span className="shrink-0 text-[13.5px] font-extrabold tabular-nums text-rvp-accent">{pct}{" "}%</span>
            <button type="button" onClick={cancelVideoUpload} className={cn(smallBtn, "bg-white/[0.08] text-rvp-text hover:bg-white/[0.14]")}>
              Annuler
            </button>
          </div>
          <div role="progressbar" aria-label="Avancement de l’envoi" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
            className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-rvp-line">
            <div className="h-full rounded-full bg-rvp-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-[12px] leading-snug text-rvp-muted">
            {upload.phase === "retrying" && upload.retry
              ? `Connexion perdue. Nouvel essai dans ${Math.round(upload.retry.delayMs / 1000)} s (${upload.retry.attempt} sur ${TUS.maxRetries}), sans tout recommencer.`
              : "Gardez cet onglet ouvert : vous pouvez continuer à naviguer sur Rivendy."}
          </p>
        </>
      ) : upload.phase === "failed" ? (
        <div className="flex flex-col gap-3">
          <p role="alert" className="text-[13.5px] leading-snug">
            <span className="block font-bold">{upload.label}</span>
            <span className="text-rvp-soft">{upload.message}</span>
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={retryVideoUpload} className={cn(smallBtn, "bg-rvp-accent text-rvp-on-accent hover:bg-rvp-accent-hover")}>
              Renvoyer
            </button>
            <button type="button" onClick={dismissVideoUpload} className={cn(smallBtn, "border border-white/15 text-rvp-text hover:bg-white/[0.06]")}>
              Fermer
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-rvp-accent" aria-hidden />
          <p role="status" className="min-w-0 flex-1 text-[13.5px] leading-snug">
            {upload.message}
            {upload.doneHref ? (
              <>
                {" "}
                <Link href={upload.doneHref} onClick={dismissVideoUpload} className="font-bold text-rvp-accent underline-offset-2 hover:underline">
                  {upload.doneLabel ?? "Voir"}
                </Link>
              </>
            ) : null}
          </p>
          <button type="button" onClick={dismissVideoUpload} aria-label="Fermer"
            className="-m-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-rvp-soft hover:bg-white/[0.08] hover:text-rvp-text">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </section>
  );
}
